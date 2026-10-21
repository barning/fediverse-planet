import type { EmbeddedPost, Post } from './model.js';
export const escapeXml = (s: string) =>
	s.replace(
		/[<>&"']/g,
		(c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!
	);
const visibleBody = (post: Pick<Post | EmbeddedPost, 'warning' | 'text'>) =>
	post.warning ? `Content warning: ${post.warning} — read the original post.` : post.text;
function itemBody(post: Post) {
	if (!post.embedded) return visibleBody(post);
	const nested = `${post.embedded.author}: ${visibleBody(post.embedded)}`;
	if (post.boost) return `${post.author} reposted ${nested}`;
	return [visibleBody(post), `Quoted post by ${nested}`].filter(Boolean).join('\n\n');
}
function itemTitle(post: Post) {
	const body = post.warning || post.text || post.embedded?.warning || post.embedded?.text || '';
	return `${post.author}${post.boost && post.embedded ? ` reposted ${post.embedded.author}` : ''}: ${body.slice(0, 80)}`;
}
export function rss(
	posts: Post[],
	title: string,
	description: string,
	site: string,
	at: string | null
) {
	const esc = escapeXml;
	return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${esc(title)}</title><link>${esc(site + '/')}</link><description>${esc(description)}</description><atom:link href="${esc(site + '/feed.xml')}" rel="self" type="application/rss+xml"/>${at ? `<lastBuildDate>${new Date(at).toUTCString()}</lastBuildDate>` : ''}${posts
		.slice()
		.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
		.slice(0, 100)
		.map(
			(p) =>
				`<item><title>${esc(itemTitle(p))}</title><link>${esc(p.embedded && p.boost ? p.embedded.url : p.url)}</link><guid isPermaLink="false">${esc(p.id)}</guid><pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate><description>${esc(itemBody(p))}</description></item>`
		)
		.join('')}</channel></rss>`;
}
