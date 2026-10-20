import sanitize from 'sanitize-html';
import { z } from 'zod';
import { postSchema, type Source } from '../src/lib/model';
const http = z.url().refine((value) => {
	const u = new URL(value);
	return u.protocol === 'https:' && !u.username && !u.password && (!u.port || u.port === '443');
});
export const statusSchema = z.object({
	id: z.string().regex(/^\d+$/),
	uri: http,
	url: http.nullable(),
	created_at: z.iso.datetime(),
	content: z.string(),
	spoiler_text: z.string(),
	visibility: z.string(),
	language: z.string().nullable(),
	sensitive: z.boolean(),
	in_reply_to_id: z.string().nullable(),
	reblog: z.unknown().nullable(),
	favourites_count: z.number().int().nonnegative().optional(),
	reblogs_count: z.number().int().nonnegative().optional(),
	replies_count: z.number().int().nonnegative().optional(),
	account: z.object({
		id: z.string(),
		display_name: z.string(),
		username: z.string(),
		acct: z.string(),
		url: http,
		discoverable: z.boolean().nullable().optional(),
		group: z.boolean().optional()
	}),
	tags: z.array(z.object({ name: z.string() })),
	media_attachments: z.array(
		z.object({ type: z.string(), url: http.nullable(), description: z.string().nullable() })
	)
});
export function plain(html: string) {
	return sanitize(html.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/p>/gi, '\n\n'), {
		allowedTags: [],
		allowedAttributes: {}
	})
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.trim();
}
export function normalize(raw: unknown, source: Source, accountId: string, at: string) {
	const s = statusSchema.parse(raw);
	if (
		s.visibility !== 'public' ||
		s.reblog !== null ||
		s.account.id !== accountId ||
		s.account.discoverable === false ||
		Date.parse(s.created_at) > Date.parse(at) + 300000
	)
		return null;
	const metrics =
		s.favourites_count !== undefined &&
		s.reblogs_count !== undefined &&
		s.replies_count !== undefined
			? { favourites: s.favourites_count, boosts: s.reblogs_count, replies: s.replies_count }
			: null;
	const instance = new URL(source.profileUrl).hostname;
	const url = s.url ?? s.uri;
	if (new URL(url).hostname !== instance) return null;
	return postSchema.parse({
		id: s.uri,
		url,
		apiId: s.id,
		sourceId: source.id,
		author: plain(s.account.display_name) || s.account.username,
		handle: `@${s.account.username}@${instance}`,
		publishedAt: s.created_at,
		firstSeenAt: at,
		verifiedAt: at,
		text: plain(s.content),
		html: '',
		warning: plain(s.spoiler_text) || (s.sensitive ? 'Sensitive content' : ''),
		language: s.language,
		tags: s.tags.map((t) => t.name.toLowerCase()),
		reply: s.in_reply_to_id !== null,
		boost: false,
		media: s.media_attachments
			.filter((m) => m.type === 'image' && m.url)
			.map((m) => ({ url: m.url!, alt: m.description ?? '' })),
		metrics,
		instance
	});
}
