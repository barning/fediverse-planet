import { test, expect } from '@playwright/test';
for (const route of ['', 'latest/', 'popular/', 'trending/', 'for-you/', 'sources/', 'about/']) {
	test(`static direct navigation ${route || 'home'}`, async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', (e) => errors.push(e.message));
		const response = await page.goto(route || './');
		expect(response?.status()).toBe(200);
		await expect(page.locator('h1')).toBeVisible();
		expect(errors).toEqual([]);
		await expect(page.getByRole('navigation', { name: 'Feed views' })).toBeVisible();
	});
}
test('the feed navigation only contains Latest and Popular', async ({ page }) => {
	await page.goto('./');
	const navigation = page.getByRole('navigation', { name: 'Feed views' });
	await expect(navigation.getByRole('link')).toHaveCount(2);
	await expect(navigation.getByRole('link').allTextContents()).resolves.toEqual([
		'Latest',
		'Popular'
	]);
	await expect(navigation.getByRole('link', { name: 'Latest' })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await expect(page.getByRole('link', { name: 'Sources', exact: true })).toBeVisible();
});
test('theme, keyboard navigation, preview warnings and mobile', async ({ page }) => {
	await page.goto('preview/');
	await expect(page.getByText('Development preview —', { exact: false })).toBeVisible();
	await expect(page.locator('.post-text a').first()).toHaveAttribute(
		'href',
		'https://example.invalid/garden'
	);
	await expect(page.locator('.embedded-post')).toBeVisible();
	await expect(page.getByText('Quoted post', { exact: true })).toBeVisible();
	await page.keyboard.press('Tab');
	await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
	await page.getByRole('button', { name: 'Use dark theme' }).click();
	await expect(page.locator('html')).toHaveClass(/dark/);
	await page.reload();
	await expect(page.getByRole('button', { name: 'Use light theme' })).toBeVisible();
	const warning = page.locator('details.content-warning');
	await expect(warning).not.toHaveAttribute('open');
	await warning.locator('summary').click();
	await expect(warning).toHaveAttribute('open');
	await page.setViewportSize({ width: 375, height: 812 });
	expect(
		await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
	).toBeTruthy();
});
test('static public datasets and feed', async ({ request }) => {
	const json = await request.get('data.json');
	expect(json.status()).toBe(200);
	const dataset = await json.json();
	expect(dataset.schemaVersion).toBe(1);
	expect(dataset.rankingConfiguration).toMatchObject({
		favouriteWeight: 1,
		boostWeight: 3,
		replyWeight: 2,
		interestBonus: 3
	});
	const feed = await request.get('feed.xml');
	expect(feed.status()).toBe(200);
	expect(await feed.text()).toContain('<rss version="2.0"');
});

test('navigation and visible media stay under the deployment path', async ({ page }) => {
	const base = process.env.BASE_PATH ?? '';
	await page.goto('preview/');
	const image = page.getByAltText('Illustration of three plants under a sunrise; local demo image');
	await image.scrollIntoViewIfNeeded();
	await expect(image).toBeVisible();
	await expect(image).toHaveAttribute('loading', 'lazy');
	await expect(image).toHaveAttribute('referrerpolicy', 'no-referrer');
	await expect
		.poll(() => image.evaluate((img) => (img as HTMLImageElement).naturalWidth))
		.toBeGreaterThan(0);
	expect(new URL((await image.getAttribute('src')) ?? '', page.url()).pathname).toBe(
		`${base}/demo-garden.svg`
	);
	await page
		.getByRole('navigation', { name: 'Feed views' })
		.getByRole('link', { name: 'Popular', exact: true })
		.click();
	await expect(page).toHaveURL(new RegExp(`${base}/popular/?$`));
	await expect(page.locator('h1')).toHaveText('Conversations worth a look.');
	const feed = await page.request.get('feed.xml');
	const parsed = await page.evaluate(
		(xml) => {
			const doc = new DOMParser().parseFromString(xml, 'application/xml');
			return {
				error: !!doc.querySelector('parsererror'),
				self: doc.querySelector('link[rel="self"]')?.getAttribute('href')
			};
		},
		await feed.text()
	);
	expect(parsed.error).toBeFalsy();
	expect(new URL(parsed.self!).pathname).toBe(`${base}/feed.xml`);
});
