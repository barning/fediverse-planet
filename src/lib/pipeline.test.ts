import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { rank, popular, trend } from './ranking.js';
import { demoPosts } from './fixtures/posts.js';
import { preferencesSchema } from './model.js';
import type { Post, Preferences, State } from './model.js';
import rawPrefs from '../../config/preferences.json';
import { collect } from '../../scripts/collect';
import { normalize } from '../../scripts/normalize';
import { safeUrl, assertPublicAddress, HttpError, type get } from '../../scripts/network';
import { prune } from '../../scripts/state';
import { rss } from './rss.js';
const prefs: Preferences = rawPrefs;
const at = '2026-10-20T12:00:00Z',
	now = Date.parse(at);
const post = (overrides: Partial<Post> = {}): Post => ({
	...structuredClone(demoPosts[0]),
	apiId: '42',
	sourceId: 'test',
	...overrides
});
const source = {
	id: 'test',
	profileUrl: 'https://social.example/@test',
	topics: ['community'],
	enabled: true
};
const status = (overrides: Record<string, unknown> = {}) => ({
	id: '42',
	uri: 'https://social.example/users/test/statuses/42',
	url: 'https://social.example/@test/42',
	created_at: '2026-10-20T10:00:00Z',
	content: '<p>Hello <script>alert(1)</script><a href="javascript:alert(1)">world</a></p>',
	spoiler_text: '',
	visibility: 'public',
	language: 'en',
	sensitive: false,
	in_reply_to_id: null,
	reblog: null,
	favourites_count: 10,
	reblogs_count: 2,
	replies_count: 1,
	account: {
		id: '7',
		username: 'test',
		display_name: 'Test',
		acct: 'test',
		url: 'https://social.example/@test',
		avatar_static: 'https://cdn.example/test.png',
		discoverable: true
	},
	tags: [{ name: 'community' }],
	media_attachments: [],
	...overrides
});
const empty = (): State => ({
	schemaVersion: 1,
	generationId: 'initial',
	asOf: null,
	posts: [],
	snapshots: [],
	rankingHistory: [],
	sources: [],
	runs: []
});
describe('ranking', () => {
	it('decays engagement with age and preserves unavailable counts', () => {
		expect(popular(post(), now, prefs.ranking)).toBeGreaterThan(
			popular(post({ publishedAt: '2026-10-19T00:00:00Z' }), now, prefs.ranking)!
		);
		expect(popular(post({ metrics: null }), now, prefs.ranking)).toBeNull();
	});
	it('requires two sufficiently separated snapshots', () => {
		expect(trend(post(), [], now, prefs.ranking)).toBeNull();
		expect(
			trend(
				post(),
				[{ postId: post().id, at, favourites: 1, boosts: 0, replies: 0 }],
				now,
				prefs.ranking
			)
		).toBeNull();
	});
	it('computes positive growth, clamps corrections, and rejects stale observations', () => {
		const samples = [
			{ postId: post().id, at: '2026-10-20T11:00:00Z', favourites: 1, boosts: 0, replies: 0 },
			{ postId: post().id, at, favourites: 6, boosts: 0, replies: 0 }
		];
		expect(trend(post(), samples, now, prefs.ranking)).toBeGreaterThan(0);
		expect(
			trend(
				post(),
				samples
					.toReversed()
					.map((s, i) => ({ ...s, at: i ? '2026-10-20T12:00:00Z' : '2026-10-20T11:00:00Z' })),
				now,
				prefs.ranking
			)
		).toBe(0);
		expect(trend(post(), samples, now + 3 * 3600000, prefs.ranking)).toBeNull();
	});
	it('uses curator-configured engagement weights and decay', () => {
		const favouritesOnly = post({ metrics: { favourites: 10, boosts: 0, replies: 0 } });
		const boostsOnly = post({ metrics: { favourites: 0, boosts: 2, replies: 0 } });
		expect(popular(favouritesOnly, now, prefs.ranking)).toBeGreaterThan(
			popular(boostsOnly, now, prefs.ranking)!
		);
		const boostFocused = { ...prefs.ranking, favouriteWeight: 0, boostWeight: 10 };
		expect(popular(boostsOnly, now, boostFocused)).toBeGreaterThan(
			popular(favouritesOnly, now, boostFocused)!
		);
		const fasterDecay = { ...prefs.ranking, popularDecay: 3 };
		expect(popular(favouritesOnly, now, fasterDecay)).toBeLessThan(
			popular(favouritesOnly, now, prefs.ranking)!
		);
	});
	it('validates ranking controls and rejects unsafe extremes', () => {
		expect(preferencesSchema.safeParse(prefs).success).toBe(true);
		expect(
			preferencesSchema.safeParse({
				...prefs,
				ranking: { ...prefs.ranking, boostWeight: 100 }
			}).success
		).toBe(false);
		expect(
			preferencesSchema.safeParse({
				...prefs,
				ranking: { ...prefs.ranking, diversityFrontSize: 0 }
			}).success
		).toBe(false);
		expect(
			preferencesSchema.safeParse({
				...prefs,
				ranking: {
					...prefs.ranking,
					trendingWindowHours: 1,
					trendingMinIntervalMinutes: 90
				}
			}).success
		).toBe(false);
	});
	it('lets the curator balance popularity, accounts and interests in For You', () => {
		const popularPost = post({
			id: 'https://example.invalid/popular',
			sourceId: 'popular',
			tags: [],
			metrics: { favourites: 100, boosts: 0, replies: 0 }
		});
		const interestPost = post({
			id: 'https://example.invalid/interest',
			sourceId: 'interest',
			tags: ['community'],
			metrics: { favourites: 0, boosts: 0, replies: 0 }
		});
		const editorial = {
			...prefs,
			ranking: {
				...prefs.ranking,
				forYouPopularityWeight: 0,
				interestBonus: 5
			}
		};
		expect(rank([popularPost, interestPost], [], editorial, 'for-you', now)[0].post.id).toBe(
			interestPost.id
		);
	});
	it('sorts Latest chronologically and ties deterministically', () => {
		const p = post(),
			q = post({ id: 'https://example.invalid/aaa', publishedAt: p.publishedAt });
		expect(rank([p, q], [], prefs, 'latest', now)[0].post.id).toBe(q.id);
	});
	it('uses windows, leaves missing metrics unavailable and applies personal preferences', () => {
		const p = post({ tags: ['community'] }),
			q = post({ id: 'https://example.invalid/other', sourceId: 'other', tags: [] });
		expect(
			rank([post({ publishedAt: '2026-09-01T00:00:00Z' })], [], prefs, 'popular', now, 1)
		).toHaveLength(0);
		expect(rank([post({ metrics: null })], [], prefs, 'popular', now)[0].score).toBeNull();
		expect(
			rank([q, p], [], { ...prefs, interests: ['community'] }, 'for-you', now)[0].post.id
		).toBe(p.id);
		expect(rank([p], [], { ...prefs, excludedTags: ['community'] }, 'for-you', now)).toHaveLength(
			0
		);
		expect(rank([p], [], { ...prefs, languages: ['de'] }, 'for-you', now)).toHaveLength(0);
		expect(rank([p], [], { ...prefs, hiddenUrls: [p.embedded!.url] }, 'latest', now)).toHaveLength(
			0
		);
	});
	it('caps an account in the first screen while retaining every result', () => {
		const list = Array.from({ length: 16 }, (_, i) =>
			post({ id: `https://example.invalid/${i}`, sourceId: i < 8 ? 'same' : String(i) })
		);
		const result = rank(list, [], prefs, 'popular', now);
		expect(result.slice(0, 10).filter((r) => r.post.sourceId === 'same')).toHaveLength(2);
		expect(result).toHaveLength(16);
	});
});
describe('normalization, publication and safety', () => {
	it.each(['private', 'direct', 'unlisted', 'unknown'])('excludes %s visibility', (visibility) => {
		expect(normalize(status({ visibility }), source, '7', at)).toBeNull();
	});
	it('rejects other authors, disabled boosts and discoverability opt-outs', () => {
		expect(normalize(status(), source, 'wrong', at)).toBeNull();
		expect(normalize(status({ reblog: status() }), source, '7', at)).toBeNull();
		const s = status();
		s.account.discoverable = false;
		expect(normalize(s, source, '7', at)).toBeNull();
	});
	it('normalizes boosts and quotes with original-author provenance', () => {
		const original = status({
			id: '84',
			uri: 'https://remote.example/users/original/statuses/84',
			url: 'https://remote.example/@original/84',
			content: '<p>Original with <a href="https://remote.example/story">a link</a></p>',
			account: {
				id: '8',
				username: 'original',
				display_name: 'Original Author',
				acct: 'original@remote.example',
				url: 'https://remote.example/@original',
				avatar_static: 'https://media.remote.example/original.png',
				discoverable: true
			}
		});
		const boost = normalize(status({ reblog: original }), source, '7', at, true)!;
		expect(boost.boost).toBe(true);
		expect(boost.embedded).toMatchObject({
			type: 'boost',
			author: 'Original Author',
			handle: '@original@remote.example',
			avatarUrl: 'https://media.remote.example/original.png'
		});
		expect(boost.metrics).toEqual(boost.embedded?.metrics);

		const quote = normalize(
			status({
				content: '<p>Worth reading.</p>',
				quote: { state: 'accepted', quoted_status: original }
			}),
			source,
			'7',
			at
		)!;
		expect(quote.boost).toBe(false);
		expect(quote.text).toBe('Worth reading.');
		expect(quote.embedded).toMatchObject({ type: 'quote', url: original.url });
	});
	it('keeps safe links, strips unsafe markup and preserves nullable counts', () => {
		const p = normalize(
			status({
				content:
					'<p>Hello <script>alert(1)</script><a href="javascript:alert(1)">world</a> <a href="https://social.example/story">read more</a></p>',
				favourites_count: undefined,
				spoiler_text: 'CW'
			}),
			source,
			'7',
			at
		)!;
		expect(p.text).toBe('Hello world read more');
		expect(p.html).toContain('href="https://social.example/story"');
		expect(p.html).toContain('rel="nofollow noopener noreferrer"');
		expect(p.html).not.toContain('javascript:');
		expect(p.avatarUrl).toBe('https://cdn.example/test.png');
		expect(p.metrics).toBeNull();
		expect(p.warning).toBe('CW');
	});
	it.each([
		'127.0.0.1',
		'10.0.0.1',
		'169.254.169.254',
		'::1',
		'::ffff:192.168.1.1',
		'fc00::1',
		'0.0.0.0'
	])('rejects non-public DNS %s', (address) => {
		expect(() => assertPublicAddress(address)).toThrow();
	});
	it('rejects cross-host, credentialed, HTTP and IP URLs', () => {
		for (const url of [
			'http://social.example/',
			'https://evil.example/',
			'https://user:password@social.example/',
			'https://127.0.0.1/'
		])
			expect(() => safeUrl(url, new Set(['social.example']))).toThrow();
		expect(safeUrl('https://social.example/@test', new Set(['social.example'])).hostname).toBe(
			'social.example'
		);
	});
	it('emits stable RSS GUIDs, original links and XML-escaped CW-safe content', () => {
		const p = post({ warning: 'Sensitive & private details', text: 'Hidden body' });
		const boost = post({
			id: 'https://example.invalid/boost',
			boost: true,
			text: '',
			embedded: { ...demoPosts[0].embedded!, type: 'boost' }
		});
		const xml = rss([p, boost], 'Planet & friends', 'Description', 'https://example.org/repo', at);
		expect(xml).toContain('https://example.org/repo/feed.xml');
		expect(xml).toContain(p.id);
		expect(xml).toContain('Sensitive &amp; private');
		expect(xml).not.toContain('Hidden body');
		expect(xml).toContain('reposted River · fictional author');
		expect(xml).toContain(boost.embedded!.url);
	});
	it('prunes old/removed posts and snapshots, bounds history while keeping interval endpoints', () => {
		const state = empty();
		state.posts = [
			post(),
			post({ id: 'https://example.invalid/old', publishedAt: '2025-01-01T00:00:00Z' })
		];
		state.snapshots = [
			{ postId: post().id, at: '2026-10-20T10:00:00Z', favourites: 1, boosts: 0, replies: 0 },
			{ postId: post().id, at: '2026-10-20T10:10:00Z', favourites: 2, boosts: 0, replies: 0 },
			{ postId: post().id, at: '2026-10-20T10:30:00Z', favourites: 3, boosts: 0, replies: 0 }
		];
		expect(prune(state, [{ ...source, id: 'test' }], prefs, now)).toBe(1);
		expect(state.snapshots).toHaveLength(2);
		expect(state.snapshots[1].favourites).toBe(3);
		prune(state, [], prefs, now);
		expect(state.posts).toHaveLength(0);
		expect(state.snapshots).toHaveLength(0);
	});
});
describe('actual collector with controlled RSS/API responses', () => {
	let dir: string, stateFile: string, sourcesFile: string, preferencesFile: string;
	beforeEach(async () => {
		dir = await mkdtemp(path.join(tmpdir(), 'planet-test-'));
		stateFile = path.join(dir, 'state.json');
		sourcesFile = path.join(dir, 'sources.json');
		preferencesFile = path.join(dir, 'prefs.json');
		await writeFile(stateFile, JSON.stringify(empty()));
		await writeFile(sourcesFile, JSON.stringify([source]));
		await writeFile(preferencesFile, JSON.stringify(prefs));
	});
	afterEach(async () => {
		await rm(dir, { recursive: true, force: true });
	});
	const feed =
		'<?xml version="1.0"?><rss version="2.0"><channel><title>Test</title><link>https://social.example</link><description>Test</description><item><guid>42</guid><link>https://social.example/@test/42</link><description>Hello</description></item></channel></rss>';
	const response = (text: string, code = 200) =>
		({ text, status: code, headers: new Headers({ etag: '"one"' }) }) as Awaited<
			ReturnType<typeof get>
		>;
	function fetcher(feedResponse = response(feed), apiStatus: unknown[] = [status()]): typeof get {
		return async (url) =>
			url.includes('/lookup?')
				? response(JSON.stringify({ id: '7', discoverable: true }))
				: url.endsWith('.rss')
					? feedResponse
					: response(JSON.stringify(apiStatus));
	}
	it('collects RSS-detected posts, preserves identity on 304, and records real observation intervals', async () => {
		await collect({ stateFile, sourcesFile, preferencesFile, at, fetcher: fetcher() });
		await collect({
			stateFile,
			sourcesFile,
			preferencesFile,
			at: '2026-10-20T12:30:00Z',
			fetcher: fetcher(response('', 304), [status({ favourites_count: 20 })])
		});
		const saved = JSON.parse(await readFile(stateFile, 'utf8')) as State;
		expect(saved.posts).toHaveLength(1);
		expect(saved.posts[0].metrics?.favourites).toBe(20);
		expect(saved.posts[0].firstSeenAt).toBe(at);
		expect(saved.snapshots).toHaveLength(2);
		expect(
			trend(saved.posts[0], saved.snapshots, Date.parse(saved.asOf!), prefs.ranking)
		).toBeGreaterThan(0);
	});
	it('does not publish an API-only post that was not detected in RSS', async () => {
		await collect({
			stateFile,
			sourcesFile,
			preferencesFile,
			at,
			fetcher: fetcher(response(feed.replaceAll('/@test/42', '/@test/999')))
		});
		expect(JSON.parse(await readFile(stateFile, 'utf8')).posts).toHaveLength(0);
	});
	it('collects a public API boost when boosts are enabled even when RSS omits it', async () => {
		const original = status({
			id: '84',
			uri: 'https://remote.example/users/original/statuses/84',
			url: 'https://remote.example/@original/84',
			account: {
				id: '8',
				username: 'original',
				display_name: 'Original',
				acct: 'original@remote.example',
				url: 'https://remote.example/@original',
				discoverable: true
			}
		});
		await collect({
			stateFile,
			sourcesFile,
			preferencesFile,
			at,
			fetcher: fetcher(response(feed.replaceAll('/@test/42', '/@test/999')), [
				status({ reblog: original })
			])
		});
		const saved = JSON.parse(await readFile(stateFile, 'utf8')) as State;
		expect(saved.posts).toHaveLength(1);
		expect(saved.posts[0]).toMatchObject({ boost: true, embedded: { type: 'boost' } });
	});
	it('preserves content on complete failure and persists 429 backoff', async () => {
		await collect({ stateFile, sourcesFile, preferencesFile, at, fetcher: fetcher() });
		await expect(
			collect({
				stateFile,
				sourcesFile,
				preferencesFile,
				at,
				fetcher: async () => {
					throw new HttpError(429, '2026-10-20T14:00:00Z');
				}
			})
		).rejects.toThrow('All enabled');
		const saved = JSON.parse(await readFile(stateFile, 'utf8'));
		expect(saved.posts).toHaveLength(1);
		expect(saved.sources[0].retryAt).toBe('2026-10-20T14:00:00Z');
	});
	it('rejects malformed XML without replacing last-known-good posts', async () => {
		await collect({ stateFile, sourcesFile, preferencesFile, at, fetcher: fetcher() });
		await expect(
			collect({
				stateFile,
				sourcesFile,
				preferencesFile,
				at,
				fetcher: fetcher(response('<!DOCTYPE evil>'))
			})
		).rejects.toThrow('All enabled');
		expect(JSON.parse(await readFile(stateFile, 'utf8')).posts).toHaveLength(1);
	});
	it('fails closed on invalid restored state', async () => {
		await writeFile(stateFile, '{"schemaVersion":999}');
		await expect(
			collect({ stateFile, sourcesFile, preferencesFile, at, fetcher: fetcher() })
		).rejects.toThrow();
	});
	it('removes visibility changes and account discovery opt-outs', async () => {
		await collect({ stateFile, sourcesFile, preferencesFile, at, fetcher: fetcher() });
		await collect({
			stateFile,
			sourcesFile,
			preferencesFile,
			at,
			fetcher: fetcher(response(feed), [status({ visibility: 'unlisted' })])
		});
		expect(JSON.parse(await readFile(stateFile, 'utf8')).posts).toHaveLength(0);
		await collect({ stateFile, sourcesFile, preferencesFile, at, fetcher: fetcher() });
		const original = fetcher();
		await collect({
			stateFile,
			sourcesFile,
			preferencesFile,
			at,
			fetcher: async (u, h, headers) =>
				u.includes('/lookup?')
					? response(JSON.stringify({ id: '7', discoverable: false }))
					: original(u, h, headers)
		});
		expect(JSON.parse(await readFile(stateFile, 'utf8')).posts).toHaveLength(0);
	});
});
