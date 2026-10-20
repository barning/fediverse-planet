import { vi, describe, it, expect, beforeEach } from 'vitest';
const mocks = vi.hoisted(() => ({
	lookup: vi.fn(),
	fetch: vi.fn(),
	connect: vi.fn(),
	destroy: vi.fn()
}));
vi.mock('node:dns/promises', () => ({ lookup: mocks.lookup }));
vi.mock('undici', () => ({
	fetch: mocks.fetch,
	Agent: class {
		constructor(options: unknown) {
			mocks.connect(options);
		}
		destroy() {
			mocks.destroy();
			return Promise.resolve();
		}
	}
}));
import { get } from '../../scripts/network';
beforeEach(() => {
	vi.clearAllMocks();
	mocks.lookup.mockResolvedValue([{ address: '93.184.215.14', family: 4 }]);
});
describe('real HTTP policy with controlled DNS and transport', () => {
	it('pins the validated IP and disables redirects while retaining HTTPS hostname', async () => {
		mocks.fetch.mockResolvedValue(new Response('{"ok":true}'));
		const result = await get('https://one.example/api', new Set(['one.example']));
		expect(result.status).toBe(200);
		const [url, init] = mocks.fetch.mock.calls[0];
		expect(url.hostname).toBe('one.example');
		expect(init.redirect).toBe('manual');
		const options = mocks.connect.mock.calls[0][0];
		const callback = vi.fn();
		options.connect.lookup('one.example', {}, callback);
		expect(callback).toHaveBeenCalledWith(null, '93.184.215.14', 4);
		expect(options.connect.autoSelectFamily).toBe(false);
		expect(mocks.destroy).toHaveBeenCalledOnce();
	});
	it('rejects a mixed public/private DNS result without sending HTTP', async () => {
		mocks.lookup.mockResolvedValue([
			{ address: '93.184.215.14', family: 4 },
			{ address: '10.0.0.2', family: 4 }
		]);
		await expect(get('https://two.example/', new Set(['two.example']))).rejects.toThrow('Blocked');
		expect(mocks.fetch).not.toHaveBeenCalled();
	});
	it('does not follow redirects', async () => {
		mocks.fetch.mockResolvedValue(
			new Response('', { status: 302, headers: { location: 'https://127.0.0.1/private' } })
		);
		await expect(get('https://three.example/', new Set(['three.example']))).rejects.toThrow(
			'HTTP 302'
		);
		expect(mocks.fetch).toHaveBeenCalledOnce();
	});
	it('enforces the decoded response size limit', async () => {
		mocks.fetch.mockResolvedValue(new Response('x'.repeat(2_000_001)));
		await expect(get('https://four.example/', new Set(['four.example']))).rejects.toThrow(
			'Response too large'
		);
		expect(mocks.destroy).toHaveBeenCalledOnce();
	});
	it('honors Retry-After without repeated calls', async () => {
		mocks.fetch.mockResolvedValue(
			new Response('', { status: 429, headers: { 'retry-after': '3600' } })
		);
		await expect(get('https://five.example/', new Set(['five.example']))).rejects.toMatchObject({
			status: 429
		});
		await expect(get('https://five.example/', new Set(['five.example']))).rejects.toMatchObject({
			status: 429
		});
		expect(mocks.fetch).toHaveBeenCalledOnce();
	});
});
