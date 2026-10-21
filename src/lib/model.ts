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
export const rankingPreferencesSchema = z
	.object({
		favouriteWeight: z.number().min(0).max(20),
		boostWeight: z.number().min(0).max(20),
		replyWeight: z.number().min(0).max(20),
		ageOffsetHours: z.number().positive().max(72),
		popularDecay: z.number().min(0).max(5),
		trendingWindowHours: z.number().min(1).max(48),
		trendingDecay: z.number().min(0).max(5),
		trendingMinIntervalMinutes: z.number().min(5).max(1440),
		trendingMaxObservationAgeHours: z.number().positive().max(48),
		forYouPopularityWeight: z.number().min(0).max(10),
		defaultAccountWeight: z.number().min(0).max(5),
		interestBonus: z.number().min(0).max(20),
		diversityMaxPerSource: z.number().int().min(1).max(20),
		diversityFrontSize: z.number().int().min(1).max(100)
	})
	.superRefine((ranking, context) => {
		if (ranking.trendingMinIntervalMinutes > ranking.trendingWindowHours * 60) {
			context.addIssue({
				code: 'custom',
				path: ['trendingMinIntervalMinutes'],
				message: 'Must fit within trendingWindowHours'
			});
		}
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
	ranking: rankingPreferencesSchema,
	hiddenUrls: z.array(httpsUrl)
});
const metricsSchema = z
	.object({
		favourites: z.number().int().nonnegative(),
		boosts: z.number().int().nonnegative(),
		replies: z.number().int().nonnegative()
	})
	.nullable();
const mediaSchema = z.object({ url: httpsUrl, alt: z.string() });
export const embeddedPostSchema = z.object({
	type: z.enum(['boost', 'quote']),
	id: httpsUrl,
	url: httpsUrl,
	author: z.string(),
	handle: z.string(),
	profileUrl: httpsUrl,
	avatarUrl: httpsUrl.optional(),
	publishedAt: z.iso.datetime(),
	text: z.string(),
	html: z.string(),
	warning: z.string(),
	tags: z.array(z.string()),
	media: z.array(mediaSchema),
	metrics: metricsSchema,
	instance: z.string()
});
export const postSchema = z.object({
	id: httpsUrl,
	url: httpsUrl,
	apiId: z.string().regex(/^\d+$/).optional(),
	sourceId: z.string(),
	author: z.string(),
	handle: z.string(),
	profileUrl: httpsUrl.optional(),
	avatarUrl: httpsUrl.optional(),
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
	embedded: embeddedPostSchema.optional(),
	media: z.array(mediaSchema),
	metrics: metricsSchema,
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
export type EmbeddedPost = z.infer<typeof embeddedPostSchema>;
export type State = z.infer<typeof stateSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type Preferences = z.infer<typeof preferencesSchema>;
export type RankingPreferences = z.infer<typeof rankingPreferencesSchema>;
export type Snapshot = z.infer<typeof snapshotSchema>;
export type Mode = 'latest' | 'popular' | 'trending' | 'for-you';
