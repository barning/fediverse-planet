import type { Mode, Post, Preferences, RankingPreferences, Snapshot } from './model.js';

const engagement = (
	m: { favourites: number; boosts: number; replies: number },
	config: RankingPreferences
) =>
	config.favouriteWeight * m.favourites +
	config.boostWeight * m.boosts +
	config.replyWeight * m.replies;

export function popular(post: Post, at: number, config: RankingPreferences) {
	return post.metrics
		? engagement(post.metrics, config) /
				(Math.max(0, (at - Date.parse(post.publishedAt)) / 3600000) + config.ageOffsetHours) **
					config.popularDecay
		: null;
}
export function trend(post: Post, snapshots: Snapshot[], at: number, config: RankingPreferences) {
	const samples = snapshots
		.filter(
			(s) =>
				s.postId === post.id &&
				Date.parse(s.at) <= at &&
				Date.parse(s.at) >= at - config.trendingWindowHours * 3600000
		)
		.sort((a, b) => a.at.localeCompare(b.at));
	if (samples.length < 2) return null;
	const first = samples[0],
		last = samples.at(-1)!;
	const hours = (Date.parse(last.at) - Date.parse(first.at)) / 3600000;
	if (
		hours < config.trendingMinIntervalMinutes / 60 ||
		at - Date.parse(last.at) > config.trendingMaxObservationAgeHours * 3600000
	)
		return null;
	return (
		Math.max(0, engagement(last, config) - engagement(first, config)) /
		hours /
		(Math.max(0, (at - Date.parse(post.publishedAt)) / 3600000) + config.ageOffsetHours) **
			config.trendingDecay
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
					? popular(p, at, prefs.ranking)
					: mode === 'trending'
						? trend(p, snapshots, at, prefs.ranking)
						: mode === 'for-you'
							? (popular(p, at, prefs.ranking) ?? 0) * prefs.ranking.forYouPopularityWeight +
								(prefs.accountWeights[p.sourceId] ?? prefs.ranking.defaultAccountWeight) +
								(matches ? prefs.ranking.interestBonus : 0)
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
								? `Engagement growth per hour over the last ${prefs.ranking.trendingWindowHours} hours`
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
		if (
			n < prefs.ranking.diversityMaxPerSource &&
			front.length < prefs.ranking.diversityFrontSize
		) {
			front.push(item);
			counts.set(item.post.sourceId, n + 1);
		} else rest.push(item);
	}
	return [...front, ...rest];
}
