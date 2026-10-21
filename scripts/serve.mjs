// Plain static server for tests: no SPA fallback or SvelteKit runtime.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('build');
const base = process.env.BASE_PATH ?? '';
createServer(async (req, res) => {
	try {
		const url = new URL(req.url ?? '/', 'http://localhost');
		if (base && !url.pathname.startsWith(base + '/')) {
			res.writeHead(404);
			res.end();
			return;
		}
		const relative = decodeURIComponent(url.pathname.slice(base.length));
		let file = path.resolve(root, '.' + relative);
		if (file !== root && !file.startsWith(root + path.sep)) {
			res.writeHead(404);
			res.end();
			return;
		}
		if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
		const body = await readFile(file);
		/** @type {Record<string,string>} */
		const types = {
			'.html': 'text/html; charset=utf-8',
			'.js': 'text/javascript',
			'.css': 'text/css',
			'.svg': 'image/svg+xml',
			'.png': 'image/png',
			'.json': 'application/json',
			'.webmanifest': 'application/manifest+json',
			'.xml': 'application/rss+xml'
		};
		res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
		res.end(body);
	} catch {
		res.writeHead(404);
		res.end('Not found');
	}
}).listen(4173, '127.0.0.1');
