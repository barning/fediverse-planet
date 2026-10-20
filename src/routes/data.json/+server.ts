import { posts, preferences, state, rankings } from '#lib/dataset.js';
export const prerender = true;
export const trailingSlash = 'never';
export function GET() {
	return Response.json({
		schemaVersion: 1,
		generationId: state.generationId,
		asOf: state.asOf,
		posts,
		rankings,
		rankingConfiguration: preferences.ranking,
		sources: state.sources.map(({ id, lastSuccess, error }) => ({ id, lastSuccess, error }))
	});
}
