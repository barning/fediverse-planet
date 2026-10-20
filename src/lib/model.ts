import { z } from 'zod';
const httpsUrl = z.url().refine((value) => {
	const url = new URL(value);
	return (
		url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443')
	);
}, 'Expected an HTTPS URL without credentials or a custom port');
export const sourceSchema = z.object({
	id: z.string().regex(/^[a-z0-9-]+$/),
	profileUrl: httpsUrl,
	feedUrl: httpsUrl.optional(),
	topics: z.array(z.string()).default([]),
	enabled: z.boolean().default(true)
});
export const preferencesSchema = z.object({
	title: z.string().min(1),
	description: z.string(),
	contact: z.string(),
	interests: z.array(z.string()),
	excludedTags: z.array(z.string()),
	languages: z.array(z.string()),
	includeReplies: z.boolean(),
	includeBoosts: z.boolean(),
	accountWeights: z.record(z.string(), z.number().min(0).max(5)),
	hiddenUrls: z.array(httpsUrl)
});
export const postSchema = z.object({
	id: httpsUrl,
	url: httpsUrl,
	apiId: z.string().regex(/^\d+$/).optional(),
	sourceId: z.string(),
	author: z.string(),
	handle: z.string(),
	publishedAt: z.iso.datetime(),
	firstSeenAt: z.iso.datetime(),
	verifiedAt: z.iso.datetime(),
	text: z.string(),
	html: z.string(),
	warning: z.string(),
	language: z.string().nullable(),
	tags: z.array(z.string()),
	reply: z.boolean(),
	boost: z.boolean(),
	media: z.array(z.object({ url: httpsUrl, alt: z.string() })),
	metrics: z
		.object({
			favourites: z.number().int().nonnegative(),
			boosts: z.number().int().nonnegative(),
			replies: z.number().int().nonnegative()
		})
		.nullable(),
	instance: z.string()
});
export const snapshotSchema = z.object({
	postId: httpsUrl,
	at: z.iso.datetime(),
	favourites: z.number().int().nonnegative(),
	boosts: z.number().int().nonnegative(),
	replies: z.number().int().nonnegative()
});
export const healthSchema = z.object({
	id: z.string(),
	lastSuccess: z.iso.datetime().nullable(),
	error: z.string().nullable(),
	etag: z.string().optional(),
	modified: z.string().optional(),
	retryAt: z.iso.datetime().optional()
});
export const stateSchema = z.object({
	schemaVersion: z.literal(1),
	generationId: z.string(),
	asOf: z.iso.datetime().nullable(),
	posts: z.array(postSchema).max(10000),
	snapshots: z.array(snapshotSchema),
	sources: z.array(healthSchema),
	rankingHistory: z
		.array(
			z.object({
				at: z.iso.datetime(),
				mode: z.enum(['latest', 'popular', 'trending', 'for-you']),
				posts: z.array(z.object({ id: httpsUrl, score: z.number().nullable() })).max(20)
			})
		)
		.default([]),
	runs: z.array(
		z.object({
			at: z.iso.datetime(),
			successful: z.number(),
			failed: z.number(),
			pruned: z.number()
		})
	)
});
export type Post = z.infer<typeof postSchema>;
export type State = z.infer<typeof stateSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type Preferences = z.infer<typeof preferencesSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type Mode = 'latest' | 'popular' | 'trending' | 'for-you';
