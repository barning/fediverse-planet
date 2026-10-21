import sanitize from 'sanitize-html';
import { z } from 'zod';
import { postSchema, type EmbeddedPost, type Source } from '../src/lib/model';

const http = z.url().refine((value) => {
	const url = new URL(value);
	return (
		url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443')
	);
});
const accountSchema = z.object({
	id: z.string(),
	display_name: z.string(),
	username: z.string(),
	acct: z.string(),
	url: http,
	avatar: z.string().optional(),
	avatar_static: z.string().optional(),
	discoverable: z.boolean().nullable().optional(),
	group: z.boolean().optional()
});
const statusContentSchema = z.object({
	id: z.string().regex(/^\d+$/),
	uri: http,
	url: http.nullable(),
	created_at: z.iso.datetime(),
	content: z.string(),
	spoiler_text: z.string(),
	visibility: z.string(),
	language: z.string().nullable(),
	sensitive: z.boolean(),
	in_reply_to_id: z.string().nullable().optional(),
	favourites_count: z.number().int().nonnegative().optional(),
	reblogs_count: z.number().int().nonnegative().optional(),
	replies_count: z.number().int().nonnegative().optional(),
	account: accountSchema,
	tags: z.array(z.object({ name: z.string() })),
	media_attachments: z.array(
		z.object({ type: z.string(), url: http.nullable(), description: z.string().nullable() })
	)
});
const quoteSchema = z.union([
	statusContentSchema,
	z.object({
		state: z.string().optional(),
		quoted_status: statusContentSchema.nullable().optional()
	})
]);
export const statusSchema = statusContentSchema.extend({
	in_reply_to_id: z.string().nullable(),
	reblog: statusContentSchema.nullable(),
	quote: quoteSchema.nullable().optional()
});
type StatusContent = z.infer<typeof statusContentSchema>;
type Quote = z.infer<typeof quoteSchema> | null | undefined;

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

export function safeHtml(html: string) {
	return sanitize(html, {
		allowedTags: ['p', 'br', 'a', 'span'],
		allowedAttributes: {
			a: ['href', 'target', 'rel'],
			span: ['class']
		},
		allowedClasses: { span: ['invisible', 'ellipsis'] },
		allowedSchemes: ['https'],
		allowedSchemesAppliedToAttributes: ['href'],
		transformTags: {
			a: (_tagName, attributes) =>
				attributes.href && http.safeParse(attributes.href).success
					? {
							tagName: 'a',
							attribs: {
								href: attributes.href,
								target: '_blank',
								rel: 'nofollow noopener noreferrer'
							}
						}
					: { tagName: 'span', attribs: {} as Record<string, string> },
			img: (_tagName, attributes) => ({
				tagName: 'span',
				attribs: {},
				text: attributes.alt ?? ''
			})
		}
	}).trim();
}

function metrics(status: StatusContent) {
	return status.favourites_count !== undefined &&
		status.reblogs_count !== undefined &&
		status.replies_count !== undefined
		? {
				favourites: status.favourites_count,
				boosts: status.reblogs_count,
				replies: status.replies_count
			}
		: null;
}

function optionalHttps(value: string | undefined) {
	return value && http.safeParse(value).success ? value : undefined;
}

function handle(status: StatusContent) {
	const accountHost = new URL(status.account.url).hostname;
	return `@${status.account.acct.includes('@') ? status.account.acct : `${status.account.username}@${accountHost}`}`;
}

function media(status: StatusContent) {
	return status.media_attachments
		.filter((attachment) => attachment.type === 'image' && attachment.url)
		.map((attachment) => ({ url: attachment.url!, alt: attachment.description ?? '' }));
}

function embedded(
	status: StatusContent,
	type: EmbeddedPost['type'],
	observedOn: string,
	at: string
): EmbeddedPost | null {
	if (
		status.visibility !== 'public' ||
		status.account.discoverable === false ||
		Date.parse(status.created_at) > Date.parse(at) + 300000
	)
		return null;
	return {
		type,
		id: status.uri,
		url: status.url ?? status.uri,
		author: plain(status.account.display_name) || status.account.username,
		handle: handle(status),
		profileUrl: status.account.url,
		...(optionalHttps(status.account.avatar_static ?? status.account.avatar)
			? { avatarUrl: optionalHttps(status.account.avatar_static ?? status.account.avatar) }
			: {}),
		publishedAt: status.created_at,
		text: plain(status.content),
		html: safeHtml(status.content),
		warning: plain(status.spoiler_text) || (status.sensitive ? 'Sensitive content' : ''),
		tags: status.tags.map((tag) => tag.name.toLowerCase()),
		media: media(status),
		metrics: metrics(status),
		instance: observedOn
	};
}

function quotedStatus(quote: Quote): StatusContent | null {
	if (!quote) return null;
	return 'id' in quote ? quote : (quote.quoted_status ?? null);
}

export function normalize(
	raw: unknown,
	source: Source,
	accountId: string,
	at: string,
	includeBoosts = false
) {
	const status = statusSchema.parse(raw);
	if (
		status.visibility !== 'public' ||
		status.account.id !== accountId ||
		status.account.discoverable === false ||
		Date.parse(status.created_at) > Date.parse(at) + 300000
	)
		return null;

	const instance = new URL(source.profileUrl).hostname;
	if (new URL(status.uri).hostname !== instance) return null;
	const boost = status.reblog !== null;
	if (boost && !includeBoosts) return null;
	const quoted = quotedStatus(status.quote);
	const embeddedStatus = status.reblog
		? embedded(status.reblog, 'boost', instance, at)
		: quoted
			? embedded(quoted, 'quote', instance, at)
			: undefined;
	if (boost && !embeddedStatus) return null;

	const candidateUrl = status.url ?? status.uri;
	const url = new URL(candidateUrl).hostname === instance ? candidateUrl : status.uri;
	const avatarUrl = optionalHttps(status.account.avatar_static ?? status.account.avatar);
	return postSchema.parse({
		id: status.uri,
		url,
		apiId: status.id,
		sourceId: source.id,
		author: plain(status.account.display_name) || status.account.username,
		handle: `@${status.account.username}@${instance}`,
		profileUrl: status.account.url,
		...(avatarUrl ? { avatarUrl } : {}),
		publishedAt: status.created_at,
		firstSeenAt: at,
		verifiedAt: at,
		text: boost ? '' : plain(status.content),
		html: boost ? '' : safeHtml(status.content),
		warning: boost
			? ''
			: plain(status.spoiler_text) || (status.sensitive ? 'Sensitive content' : ''),
		language: boost && embeddedStatus ? null : status.language,
		tags:
			boost && embeddedStatus
				? embeddedStatus.tags
				: status.tags.map((tag) => tag.name.toLowerCase()),
		reply: !boost && status.in_reply_to_id !== null,
		boost,
		...(embeddedStatus ? { embedded: embeddedStatus } : {}),
		media: boost ? [] : media(status),
		metrics: boost && embeddedStatus ? embeddedStatus.metrics : metrics(status),
		instance
	});
}
