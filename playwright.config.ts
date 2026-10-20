import { defineConfig } from '@playwright/test';
export default defineConfig({
	webServer: { command: 'node scripts/serve.mjs', port: 4173, reuseExistingServer: false },
	use: {
		baseURL: `http://127.0.0.1:4173${process.env.BASE_PATH ?? ''}/`,
		browserName: 'chromium',
		launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
	},
	testMatch: 'tests/**/*.e2e.ts'
});
