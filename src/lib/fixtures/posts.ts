import type { Post } from '../model.js';
export const demoPosts: Post[] = [
	{
		id: 'https://example.invalid/posts/1',
		url: 'https://example.invalid/posts/1',
		sourceId: 'demo',
		author: 'Alex · fictional author',
		handle: '@alex@example.invalid',
		publishedAt: '2026-10-20T10:00:00Z',
		firstSeenAt: '2026-10-20T10:00:00Z',
		verifiedAt: '2026-10-20T10:00:00Z',
		text: 'A small community garden can change the shape of a neighbourhood. Today we shared seeds, fixed a bench, and talked about what it means to make things together.\n\nThe best tools are often the ones that leave room for someone else to join in. '.repeat(
			3
		),
		html: '',
		warning: '',
		language: 'en',
		tags: ['community'],
		reply: false,
		boost: false,
		media: [
			{
				url: '/demo-garden.svg',
				alt: 'Illustration of three plants under a sunrise; local demo image'
			}
		],
		metrics: { favourites: 12, boosts: 3, replies: 2 },
		instance: 'example.invalid'
	},
	{
		id: 'https://example.invalid/posts/2',
		url: 'https://example.invalid/posts/2',
		sourceId: 'demo-2',
		author: 'Sam · fictional author',
		handle: '@sam@example.invalid',
		publishedAt: '2026-10-20T09:00:00Z',
		firstSeenAt: '2026-10-20T10:00:00Z',
		verifiedAt: '2026-10-20T10:00:00Z',
		text: 'This fixture tests a collapsed content warning and unavailable engagement. No remote profile or avatar is fetched.',
		html: '',
		warning: 'Discussion of burnout',
		language: null,
		tags: ['opensource'],
		reply: false,
		boost: false,
		media: [],
		metrics: null,
		instance: 'example.invalid'
	}
];
