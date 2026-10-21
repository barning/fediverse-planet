import { preferences } from '#lib/dataset.js';

export const prerender = true;

export function GET() {
	const manifest = {
		id: './',
		name: preferences.title,
		short_name: preferences.title,
		description: preferences.description,
		lang: 'en',
		start_url: './',
		scope: './',
		display: 'standalone',
		background_color: '#f8f7f2',
		theme_color: '#315b43',
		categories: ['news', 'social'],
		icons: [
			{
				src: 'icons/icon-192.png',
				sizes: '192x192',
				type: 'image/png',
				purpose: 'any'
			},
			{
				src: 'icons/icon-512.png',
				sizes: '512x512',
				type: 'image/png',
				purpose: 'any'
			},
			{
				src: 'icons/icon-512-maskable.png',
				sizes: '512x512',
				type: 'image/png',
				purpose: 'maskable'
			}
		],
		shortcuts: [
			{ name: 'Popular', short_name: 'Popular', url: 'popular/' },
			{ name: 'Latest', short_name: 'Latest', url: 'latest/' }
		]
	};

	return new Response(JSON.stringify(manifest), {
		headers: {
			'content-type': 'application/manifest+json; charset=utf-8',
			'cache-control': 'public, max-age=0, must-revalidate'
		}
	});
}
