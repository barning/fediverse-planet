import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import Parser from 'rss-parser';
import { z } from 'zod';
import { stateSchema, sourceSchema, preferencesSchema } from '../src/lib/model';
import { get, HttpError, safeUrl } from './network';
import { normalize } from './normalize';
import { rank } from '../src/lib/ranking';
import type { Mode } from '../src/lib/model';
import { prune } from './state';

export async function collect(
	options: {
		stateFile?: string;
		sourcesFile?: string;
		preferencesFile?: string;
		fetcher?: typeof get;
		at?: string;
	} = {}
) {
	const fetcher = options.fetcher ?? get;
	const stateFile = options.stateFile ?? process.env.STATE_FILE ?? 'data/state.json';
	const state = stateSchema.parse(JSON.parse(await readFile(stateFile, 'utf8')));
	const sources = sourceSchema
		.array()
		.parse(JSON.parse(await readFile(options.sourcesFile ?? 'config/sources.json', 'utf8')));
	const prefs = preferencesSchema.parse(
		JSON.parse(await readFile(options.preferencesFile ?? 'config/preferences.json', 'utf8'))
	);
	if (new Set(sources.map((s) => s.id)).size !== sources.length)
		throw new Error('Duplicate source IDs');
	const originalPosts = structuredClone(state.posts),
		originalSnapshots = structuredClone(state.snapshots);
	const at = options.at ?? new Date().toISOString(),
		now = Date.parse(at);
	let successful = 0,
		failed = 0;
	const parser = new Parser({ maxRedirects: 0 });
	const hostBackoff = new Map<string, string>();
	for (const src of sources) {
		const retry = state.sources.find((h) => h.id === src.id)?.retryAt;
		if (
			retry &&
			Date.parse(retry) >
				Date.parse(hostBackoff.get(new URL(src.profileUrl).hostname) ?? '1970-01-01')
		)
			hostBackoff.set(new URL(src.profileUrl).hostname, retry);
	}

	for (const source of sources.filter((s) => s.enabled)) {
		const previous = state.sources.find((s) => s.id === source.id);
		try {
			const retry = hostBackoff.get(new URL(source.profileUrl).hostname);
			if (retry && Date.parse(retry) > now) throw new HttpError(429, retry);
			const profile = new URL(source.profileUrl);
			const match = /^\/@([A-Za-z0-9_]+)\/?$/.exec(profile.pathname);
			if (!match) throw new Error('Use a home-server Mastodon profile URL /@username');
			const hosts = new Set([profile.hostname]);
			const api = async (path: string) =>
				JSON.parse((await fetcher(new URL(path, profile.origin).href, hosts)).text);
			const account = z
				.object({ id: z.string().regex(/^\d+$/), discoverable: z.boolean().nullable().optional() })
				.parse(await api(`/api/v1/accounts/lookup?acct=${encodeURIComponent(match[1])}`));
			if (account.discoverable === false) {
				state.posts = state.posts.filter((p) => p.sourceId !== source.id);
				state.sources = state.sources.filter((s) => s.id !== source.id);
				state.sources.push({
					id: source.id,
					lastSuccess: at,
					error: 'Excluded: account opted out of discovery'
				});
				successful++;
				continue;
			}
			const feedUrl = source.feedUrl ?? `${profile.origin}/@${match[1]}.rss`;
			safeUrl(feedUrl, hosts);
			const feed = await fetcher(feedUrl, hosts, {
				...(previous?.etag ? { 'If-None-Match': previous.etag } : {}),
				...(previous?.modified ? { 'If-Modified-Since': previous.modified } : {})
			});
			const links = new Set<string>();
			if (feed.status !== 304) {
				if (/<!DOCTYPE|<!ENTITY/i.test(feed.text)) throw new Error('Unsafe XML declaration');
				const parsed = await parser.parseString(feed.text);
				for (const item of parsed.items)
					if (item.link) {
						try {
							links.add(safeUrl(item.link, hosts).href);
						} catch {
							/* Ignore foreign items. */
						}
					}
			}
			const recent = z
				.array(z.unknown())
				.parse(await api(`/api/v1/accounts/${account.id}/statuses?limit=40&exclude_reblogs=true`));
			const candidates: unknown[] = [...recent];
			const seenApi = new Set(recent.map((s) => (s as { id?: string }).id));
			// Rotate older posts by verification age. A hard bound keeps API use predictable.
			const older = state.posts
				.filter((p) => p.sourceId === source.id && p.apiId && !seenApi.has(p.apiId))
				.sort((a, b) => a.verifiedAt.localeCompare(b.verifiedAt))
				.slice(0, 60);
			for (const post of older) {
				try {
					candidates.push(await api(`/api/v1/statuses/${post.apiId}`));
				} catch (e) {
					if (e instanceof HttpError && (e.status === 404 || e.status === 410))
						state.posts = state.posts.filter((p) => p.id !== post.id);
					else throw e;
				}
			}
			for (const raw of candidates) {
				const normalized = normalize(raw, source, account.id, at);
				if (!normalized) {
					const id = (raw as { uri?: string }).uri;
					if (id) state.posts = state.posts.filter((p) => p.id !== id);
					continue;
				}
				const index = state.posts.findIndex((p) => p.id === normalized.id);
				if (index < 0 && !links.has(normalized.url) && !links.has(normalized.id)) continue; // RSS detects; API verifies/enriches.
				if (prefs.hiddenUrls.includes(normalized.url)) continue;
				if (index >= 0) {
					normalized.firstSeenAt = state.posts[index].firstSeenAt;
					state.posts[index] = normalized;
				} else state.posts.push(normalized);
				if (normalized.metrics)
					state.snapshots.push({ postId: normalized.id, at, ...normalized.metrics });
			}
			const health = {
				id: source.id,
				lastSuccess: at,
				error: null,
				etag: feed.headers.get('etag') ?? previous?.etag,
				modified: feed.headers.get('last-modified') ?? previous?.modified
			};
			state.sources = state.sources.filter((s) => s.id !== source.id);
			state.sources.push(health);
			successful++;
			console.log(
				JSON.stringify({
					event: 'source_complete',
					source: source.id,
					posts: state.posts.filter((p) => p.sourceId === source.id).length
				})
			);
		} catch (error) {
			failed++;
			const message =
				error instanceof HttpError
					? error.message
					: 'Collection failed; check profile, DNS, feed and API availability';
			state.sources = state.sources.filter((s) => s.id !== source.id);
			state.sources.push({
				id: source.id,
				lastSuccess: previous?.lastSuccess ?? null,
				error: message,
				...(error instanceof HttpError && error.retryAt ? { retryAt: error.retryAt } : {})
			});
			console.error(
				JSON.stringify({
					event: 'source_failed',
					source: source.id,
					error: message,
					category: error instanceof Error ? error.name : 'unknown',
					code: error && typeof error === 'object' && 'code' in error ? error.code : undefined
				})
			);
		}
	}
	if (!successful && sources.some((s) => s.enabled)) {
		// Persist only operational health/backoff; never replace last-known-good content on total failure.
		state.posts = originalPosts;
		state.snapshots = originalSnapshots;
		state.runs = state.runs.filter((r) => Date.parse(r.at) >= now - 30 * 86400000).slice(-1499);
		state.runs.push({ at, successful, failed, pruned: 0 });
		const serialized = JSON.stringify(state, null, 2) + '\n';
		if (Buffer.byteLength(serialized) > 60 * 1024 * 1024)
			throw new Error('State exceeds 60 MiB; reduce collection retention/capacity before retrying');
		await writeFile(`${stateFile}.tmp`, serialized);
		await rename(`${stateFile}.tmp`, stateFile);
		throw new Error(
			'All enabled sources failed; last-known-good content preserved. Health/backoff saved. No deployment.'
		);
	}
	state.generationId = randomUUID();
	state.asOf = at;
	const pruned = prune(state, sources, prefs, now);
	for (const mode of ['latest', 'popular', 'trending', 'for-you'] as Mode[])
		state.rankingHistory.push({
			at,
			mode,
			posts: rank(
				state.posts,
				state.snapshots,
				prefs,
				mode,
				now,
				7,
				Object.fromEntries(sources.map((s) => [s.id, s.topics]))
			)
				.slice(0, 20)
				.map((r) => ({ id: r.post.id, score: r.score }))
		});
	state.runs.push({ at, successful, failed, pruned });
	stateSchema.parse(state);
	await mkdir(dirname(stateFile), { recursive: true });
	const serialized = JSON.stringify(state, null, 2) + '\n';
	if (Buffer.byteLength(serialized) > 60 * 1024 * 1024)
		throw new Error('State exceeds 60 MiB; reduce collection retention/capacity before retrying');
	await writeFile(`${stateFile}.tmp`, serialized);
	await rename(`${stateFile}.tmp`, stateFile);
	console.log(
		JSON.stringify({
			event: 'collection_complete',
			generation: state.generationId,
			successful,
			failed,
			pruned,
			posts: state.posts.length
		})
	);
}
if (process.argv[1]?.endsWith('/collect.ts'))
	collect().catch((e) => {
		console.error(e.message);
		process.exitCode = 1;
	});
