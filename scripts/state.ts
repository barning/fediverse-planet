import type { State, Source, Preferences } from '../src/lib/model';
export function prune(state: State, sources: Source[], preferences: Preferences, now: number) {
	const before = state.posts.length;
	state.posts = state.posts
		.filter(
			(p) =>
				sources.some((s) => s.enabled && s.id === p.sourceId) &&
				!preferences.hiddenUrls.includes(p.url) &&
				Date.parse(p.publishedAt) >= now - 90 * 86400000
		)
		.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id))
		.slice(0, 10000);
	const ids = new Set(state.posts.map((p) => p.id));
	// Last observation per hour for 7d; first and last per day thereafter.
	const groups = new Map<string, typeof state.snapshots>();
	for (const s of state.snapshots) {
		if (!ids.has(s.postId) || Date.parse(s.at) < now - 90 * 86400000) continue;
		const width = now - Date.parse(s.at) <= 7 * 86400000 ? 3600000 : 86400000;
		const key = `${s.postId}:${Math.floor(Date.parse(s.at) / width)}`;
		const values = groups.get(key) ?? [];
		values.push(s);
		groups.set(key, values);
	}
	state.snapshots = [...groups.values()].flatMap((values) => {
		values.sort((a, b) => a.at.localeCompare(b.at));
		return values.length > 1 ? [values[0], values.at(-1)!] : values;
	});
	state.runs = state.runs.filter((r) => Date.parse(r.at) >= now - 30 * 86400000).slice(-1500);
	state.rankingHistory = state.rankingHistory
		.filter((r) => Date.parse(r.at) >= now - 30 * 86400000)
		.slice(-5756);
	return before - state.posts.length;
}
