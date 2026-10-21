import { readFile, writeFile } from 'node:fs/promises';
import { rank } from '../src/lib/ranking';
import type { Mode } from '../src/lib/model';
import { stateSchema, sourceSchema, preferencesSchema } from '../src/lib/model';
const state = stateSchema.parse(JSON.parse(await readFile('data/state.json', 'utf8')));
const sources = sourceSchema
	.array()
	.parse(JSON.parse(await readFile('config/sources.json', 'utf8')));
const preferences = preferencesSchema.parse(
	JSON.parse(await readFile('config/preferences.json', 'utf8'))
);
if (new Set(sources.map((s) => s.id)).size !== sources.length)
	throw new Error('Duplicate source IDs');
if (new Set(state.posts.map((p) => p.id)).size !== state.posts.length)
	throw new Error('Duplicate canonical posts');
const posts = state.posts.filter(
	(p) =>
		sources.some((s) => s.id === p.sourceId && s.enabled) &&
		!preferences.hiddenUrls.includes(p.url) &&
		!(p.embedded && preferences.hiddenUrls.includes(p.embedded.url)) &&
		(preferences.includeReplies || !p.reply) &&
		(preferences.includeBoosts || !p.boost) &&
		Date.parse(p.verifiedAt) >= Date.parse(state.asOf ?? '1970-01-01') - 86400000
);
const ids = new Set(posts.map((p) => p.id));
const topics = Object.fromEntries(sources.map((s) => [s.id, s.topics]));
const rankings = Object.fromEntries(
	(['latest', 'popular', 'trending', 'for-you'] as Mode[]).map((mode) => [
		mode,
		Object.fromEntries(
			[1, 7, 30].map((days) => [
				days,
				rank(
					posts,
					state.snapshots,
					preferences,
					mode,
					Date.parse(state.asOf ?? '1970-01-01'),
					days,
					topics
				).map((r) => ({ id: r.post.id, score: r.score, reason: r.reason }))
			])
		)
	])
);
await writeFile(
	'data/public.json',
	JSON.stringify({
		state: {
			...state,
			posts,
			snapshots: state.snapshots.filter((s) => ids.has(s.postId)),
			sources: state.sources.map(({ id, lastSuccess, error }) => ({ id, lastSuccess, error })),
			runs: [],
			rankingHistory: []
		},
		sources,
		preferences: { ...preferences, hiddenUrls: [] },
		rankings
	}) + '\n'
);
console.log(
	`Validated generation ${state.generationId}: ${sources.length} sources, ${posts.length} publishable posts for ${preferences.title}`
);
