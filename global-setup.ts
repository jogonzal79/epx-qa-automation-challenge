// global-setup.ts
import { chromium } from '@playwright/test';
import type { FullConfig } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

export default async function globalSetup(config: FullConfig) {
  const EMAIL = process.env.EPX_EMAIL;
  const PASS  = process.env.EPX_PASS;
  if (!EMAIL || !PASS) {
    throw new Error('Faltan EPX_EMAIL y/o EPX_PASS en .env o variables de entorno.');
  }

  const browser = await chromium.launch();
  const page = await browser.newPage();

  // --- Login ---
  await page.goto('https://app-stg.epxworldwide.com/log-in', { waitUntil: 'domcontentloaded' });

  // Inputs robustos
  const emailInput = page
    .getByRole('textbox', { name: 'example@email.com' })
    .or(page.locator('input[type="email"], input[name="email"]'));
  const passInput = page
    .getByRole('textbox', { name: 'Password' })
    .or(page.locator('input[type="password"], input[name="password"]'));

  await emailInput.fill(EMAIL);
  await passInput.fill(PASS);

  // Scope al form que contiene el password (evita el botón "Login" del header)
  const loginForm = page.locator('form:has(input[type="password"])').first();
  const loginBtn  = loginForm.locator('button[type="submit"]').first();

  // Haz click solo al submit del formulario de login
  await loginBtn.click();

  // --- Post-login flexible: /home o / + indicadores de sesión ---
  const authSelectors = [
    'a[href="/carl"]',
    '[data-testid*="profile"]',
    'header [role="navigation"]',
    'nav[role="navigation"]',
  ].join(',');

  const ok = await Promise.race([
    page.waitForURL('**/home', { timeout: 40_000 }).then(() => true).catch(() => false),
    page.waitForURL('**/',    { timeout: 40_000 }).then(() => true).catch(() => false),
    page.waitForSelector(authSelectors, { timeout: 40_000 }).then(() => true).catch(() => false),
  ]);

  if (!ok) {
    const url = page.url();
    await page.screenshot({ path: 'test-results/login-timeout.png', fullPage: true });
    await browser.close();
    throw new Error(`No se detectó navegación post-login. URL actual: ${url}`);
  }

  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(500);

  const storagePath =
    (config.projects?.[0]?.use as any)?.storageState ?? 'storageState.json';
  await page.context().storageState({ path: storagePath });

  await browser.close();
}
