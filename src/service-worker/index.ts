import { version } from '$app/env';
import { assets, immutable, prerendered } from '$app/manifest';
import { resolve } from '$app/paths';
import { self } from '$app/service-worker';

const CACHE_PREFIX = 'fediverse-planet-';
const CACHE = `${CACHE_PREFIX}${version}`;
const ROOT = resolve('/');
const fromBase = (path: string) => `${ROOT}${path.replace(/^\//, '')}`;
const STATIC_FILES = [
	...immutable.map(({ path }) => fromBase(path)),
	...assets.map(({ path }) => fromBase(path))
];
const OFFLINE_FILES = [
	...new Set([ROOT, ...STATIC_FILES, ...prerendered.map(({ path }) => fromBase(path))])
];
const STATIC_PATHS: Set<string> = new Set(STATIC_FILES);

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(OFFLINE_FILES)));
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			await Promise.all(
				(await caches.keys())
					.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
					.map((key) => caches.delete(key))
			);
			await self.clients.claim();
		})()
	);
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);
	if (url.origin !== self.location.origin) return;

	event.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);

			if (STATIC_PATHS.has(url.pathname)) {
				const cached = await cache.match(url.pathname);
				if (cached) return cached;
			}

			try {
				const response = await fetch(event.request);
				if (response.ok && !response.headers.get('cache-control')?.includes('no-store')) {
					await cache.put(event.request, response.clone());
				}
				return response;
			} catch (error) {
				const cached =
					(await cache.match(event.request, { ignoreSearch: true })) ??
					(await cache.match(url.pathname)) ??
					(event.request.mode === 'navigate' ? await cache.match(ROOT) : undefined);

				if (cached) return cached;
				throw error;
			}
		})()
	);
});
