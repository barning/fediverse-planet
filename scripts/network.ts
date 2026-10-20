import { lookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
import { Agent, fetch as request } from 'undici';

export function assertPublicAddress(address: string) {
	const ip = ipaddr.process(address);
	if (ip.range() !== 'unicast') throw new Error('Blocked non-public address');
}
export function safeUrl(input: string, hosts: Set<string>) {
	const url = new URL(input);
	if (
		url.protocol !== 'https:' ||
		url.username ||
		url.password ||
		(url.port && url.port !== '443') ||
		!hosts.has(url.hostname) ||
		ipaddr.isValid(url.hostname)
	)
		throw new Error('Blocked URL');
	return url;
}
export class HttpError extends Error {
	constructor(
		public status: number,
		public retryAt?: string
	) {
		super(`HTTP ${status}`);
	}
}
const nextRequest = new Map<string, number>();
const blockedUntil = new Map<string, number>();
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function getOnce(input: string, hosts: Set<string>, headers: Record<string, string> = {}) {
	const url = safeUrl(input, hosts);
	if ((blockedUntil.get(url.hostname) ?? 0) > Date.now())
		throw new HttpError(429, new Date(blockedUntil.get(url.hostname)!).toISOString());
	await wait(Math.max(0, (nextRequest.get(url.hostname) ?? 0) - Date.now()));
	const addresses = await lookup(url.hostname, { all: true });
	if (!addresses.length) throw new Error('DNS lookup returned no addresses');
	addresses.forEach((a) => assertPublicAddress(a.address));
	// Pin the checked address at connect time, preserving hostname/SNI and TLS verification.
	const chosen = addresses.find((a) => a.family === 4) ?? addresses[0];
	const dispatcher = new Agent({
		connect: {
			autoSelectFamily: false,
			lookup: (_hostname, _options, callback) => callback(null, chosen.address, chosen.family)
		}
	});
	try {
		nextRequest.set(url.hostname, Date.now() + 1100);
		const response = await request(url, {
			dispatcher,
			redirect: 'manual',
			signal: AbortSignal.timeout(20000),
			headers: {
				'User-Agent': 'PersonalFediversePlanet/1.0 (+https://github.com/barning/fediverse-planet)',
				Accept: 'application/json, application/rss+xml, application/atom+xml;q=0.9',
				...headers
			}
		});
		if (response.status === 429 || response.status === 503) {
			const retry = response.headers.get('retry-after');
			const until = Math.max(
				Date.now() + 60000,
				retry && /^\d+$/.test(retry)
					? Date.now() + Number(retry) * 1000
					: retry
						? Date.parse(retry) || Date.now() + 60000
						: Date.now() + 60000
			);
			blockedUntil.set(url.hostname, until);
			throw new HttpError(response.status, new Date(until).toISOString());
		}
		if (response.status === 304) {
			await response.body?.cancel();
			return { status: 304, text: '', headers: response.headers };
		}
		if (!response.ok) throw new HttpError(response.status);
		let size = 0;
		const chunks: Uint8Array[] = [];
		if (Number(response.headers.get('content-length')) > 2_000_000)
			throw new Error('Response too large');
		for await (const chunk of response.body!) {
			size += chunk.length;
			if (size > 2_000_000) throw new Error('Response too large');
			chunks.push(chunk);
		}
		return {
			status: response.status,
			text: Buffer.concat(chunks).toString('utf8'),
			headers: response.headers
		};
	} finally {
		await dispatcher.destroy();
	}
}

export async function get(input: string, hosts: Set<string>, headers: Record<string, string> = {}) {
	for (let attempt = 0; ; attempt++) {
		try {
			return await getOnce(input, hosts, headers);
		} catch (error) {
			if (
				attempt >= 1 ||
				(error instanceof HttpError && (error.retryAt || error.status < 500)) ||
				(error instanceof Error && /Blocked|too large/.test(error.message))
			)
				throw error;
			await wait(1000 + Math.floor(Math.random() * 500));
		}
	}
}
