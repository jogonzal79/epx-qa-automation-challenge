import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test',
  timeout: 30 * 1000,
  expect: { timeout: 5 * 1000 },

  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],

  use: {
    baseURL: 'https://app-stg.epxworldwide.com',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
    headless: true,
  },

  projects: [
    { name: 'Chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'Firefox',  use: { ...devices['Desktop Firefox'] } },
  ],
});
