import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test',
  timeout: 90 * 1000, // Más tiempo para CI
  expect: { timeout: 10 * 1000 }, // Más tiempo para expects

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
    // Configuración más robusta para CI
    actionTimeout: 30 * 1000,
    navigationTimeout: 45 * 1000,
  },

  projects: [
    { 
      name: 'Chromium', 
      use: { 
        ...devices['Desktop Chrome'],
        // Configuración específica para C.A.R.L. en CI
        launchOptions: {
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage'
          ]
        }
      } 
    }
  ],
});