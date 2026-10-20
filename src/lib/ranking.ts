import type { Mode, Post, Preferences, Snapshot } from './model.js';
const engagement = (m: { favourites: number; boosts: number; replies: number }) =>
	m.favourites + 3 * m.boosts + 2 * m.replies;
export function popular(post: Post, at: number) {
	return post.metrics
		? engagement(post.metrics) /
				(Math.max(0, (at - Date.parse(post.publishedAt)) / 3600000) + 2) ** 1.2
		: null;
}
export function trend(post: Post, snapshots: Snapshot[], at: number) {
	const samples = snapshots
		.filter(
			(s) => s.postId === post.id && Date.parse(s.at) <= at && Date.parse(s.at) >= at - 6 * 3600000
		)
		.sort((a, b) => a.at.localeCompare(b.at));
	if (samples.length < 2) return null;
	const first = samples[0],
		last = samples.at(-1)!;
	const hours = (Date.parse(last.at) - Date.parse(first.at)) / 3600000;
	if (hours < 0.5 || at - Date.parse(last.at) > 2 * 3600000) return null;
	return (
		Math.max(0, engagement(last) - engagement(first)) /
		hours /
		(Math.max(0, (at - Date.parse(post.publishedAt)) / 3600000) + 2) ** 0.5
	);
}
export function rank(
	posts: Post[],
	snapshots: Snapshot[],
	prefs: Preferences,
	mode: Mode,
	at: number,
	days = 7,
	sourceTopics: Record<string, string[]> = {}
) {
	const normalize = (s: string) => s.replace(/^#/, '').toLowerCase();
	const eligible = posts.filter(
		(p) =>
			!prefs.hiddenUrls.includes(p.url) &&
			(prefs.includeReplies || !p.reply) &&
			(prefs.includeBoosts || !p.boost)
	);
	const result = eligible
		.filter((p) => mode === 'latest' || at - Date.parse(p.publishedAt) <= days * 86400000)
		.map((p) => {
			const matches = [...p.tags, ...(sourceTopics[p.sourceId] ?? [])].some((t) =>
				prefs.interests.map(normalize).includes(normalize(t))
			);
			const score =
				mode === 'popular'
					? popular(p, at)
					: mode === 'trending'
						? trend(p, snapshots, at)
						: mode === 'for-you'
							? (popular(p, at) ?? 0) + (prefs.accountWeights[p.sourceId] ?? 1) + (matches ? 3 : 0)
							: Date.parse(p.publishedAt);
			return {
				post: p,
				score,
				reason:
					mode === 'for-you'
						? matches
							? 'Matches your configured interests'
							: 'Curator account preference'
						: mode === 'popular'
							? 'Engagement with freshness decay'
							: mode === 'trending'
								? 'Engagement growth per hour over the last 6 hours'
								: 'Newest first'
			};
		})
		.filter(
			(r) =>
				mode !== 'for-you' ||
				(!r.post.tags.some((t) => prefs.excludedTags.map(normalize).includes(normalize(t))) &&
					(!prefs.languages.length ||
						(!!r.post.language && prefs.languages.includes(r.post.language))))
		);
	result.sort(
		(a, b) =>
			(b.score ?? -Infinity) - (a.score ?? -Infinity) ||
			b.post.publishedAt.localeCompare(a.post.publishedAt) ||
			a.post.id.localeCompare(b.post.id)
	);
	if (mode === 'latest') return result;
	// First screen: at most two posts per account; remaining posts stay reachable.
	const counts = new Map<string, number>();
	const front: typeof result = [],
		rest: typeof result = [];
	for (const item of result) {
		const n = counts.get(item.post.sourceId) ?? 0;
		if (n < 2 && front.length < 12) {
			front.push(item);
			counts.set(item.post.sourceId, n + 1);
		} else rest.push(item);
	}
	return [...front, ...rest];
}
