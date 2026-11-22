import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	workers: 1,
	use: { baseURL: 'http://127.0.0.1:5179' },
	webServer: {
		command: 'pnpm dev --host 127.0.0.1 --port 5179',
		url: 'http://127.0.0.1:5179/create',
		reuseExistingServer: false,
		env: { DATABASE_URL: 'postgres://postgres:synthetic-test-only@127.0.0.1:55432/cal72_test' }
	}
});
