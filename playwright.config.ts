// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

export default defineConfig({
  testDir: './test',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : 4,
  reporter: 'html',
  
  // IMPORTANTE: Configurar global setup
  globalSetup: './global-setup.ts',
  
  use: {
    baseURL: 'https://app-stg.epxworldwide.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // IMPORTANTE: Usar el estado de sesión guardado por defecto
    storageState: 'storageState.json',
  },

  projects: [
    {
      name: 'Chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // El storage state se hereda del 'use' global
        // pero se puede sobrescribir aquí si es necesario
      },
    },
  ],

  webServer: process.env.CI ? {
    command: 'npm run preview',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  } : undefined,
});