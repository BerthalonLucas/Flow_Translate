import { defineConfig } from '@playwright/test';

const port = process.env.FLOWTRANSLATE_TEST_PORT ?? '5173';
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/*.pw.ts', '**/*.spec.mjs'],
  timeout: 20_000,
  use: { baseURL, headless: true, screenshot: 'only-on-failure' },
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
  reporter: [['list']],
});
