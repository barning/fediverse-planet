import type { Post } from './model.js';
export const escapeXml = (s: string) =>
	s.replace(
		/[<>&"']/g,
		(c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!
	);
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
				`<item><title>${esc(p.author + ': ' + (p.warning || p.text.slice(0, 80)))}</title><link>${esc(p.url)}</link><guid isPermaLink="false">${esc(p.id)}</guid><pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate><description>${esc(p.warning ? 'Content warning: ' + p.warning + ' — read the original post.' : p.text)}</description></item>`
		)
		.join('')}</channel></rss>`;
}
