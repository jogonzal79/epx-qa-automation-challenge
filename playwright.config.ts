import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test', // Carpeta donde están tus archivos .spec.ts
  timeout: 30 * 1000, // 30 segundos por test
  expect: {
    timeout: 5000, // Tiempo para esperas tipo expect()
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1, // Puedes subirlo si haces tests en paralelo

  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],

  use: {
    baseURL: 'https://app-stg.epxworldwide.com',
    trace: 'on', // Puedes cambiar a 'retain-on-failure' para grabar solo si falla
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
    headless: true, // Cambia a false para ver en modo visible (dev)
    launchOptions: {
      slowMo: 50, // Ralentiza para ver acciones en debug
    },
  },

  // Puedes definir proyectos por navegador aquí:
  projects: [
    {
      name: 'Chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    // Si no necesitas Firefox puedes comentarlo
    // {
    //   name: 'WebKit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],
});
