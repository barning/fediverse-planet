import { posts, state, preferences } from '#lib/dataset.js';
import { rss } from '#lib/rss.js';
export const prerender = true;
export const trailingSlash = 'never';
export function GET() {
	return new Response(
		rss(
			posts,
			preferences.title,
			preferences.description,
			(process.env.SITE_URL ?? 'https://example.invalid').replace(/\/$/, ''),
			state.asOf
		),
		{ headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } }
	);
}
