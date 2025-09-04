import type { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitBtn: Locator;

  constructor(page: Page) {
    this.page = page;

    // Selectores confirmados con codegen
    this.emailInput = page.getByRole('textbox', { name: 'example@email.com' });
    this.passwordInput = page.getByRole('textbox', { name: 'Password' });
    this.submitBtn = page.getByRole('button', { name: 'LOGIN', exact: true });
  }

  async goto() {
    await this.page.goto('https://app-stg.epxworldwide.com/log-in', { waitUntil: 'domcontentloaded' });
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async fillCredentials(email: string, password: string) {
    await this.emailInput.waitFor({ state: 'visible', timeout: 15000 });
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
  }

  async submitLogin() {
    await this.submitBtn.click();

    // No asumimos /home: esperamos a que la app post-login este lista
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForLoadState('networkidle').catch(() => {});

    // Simple: esperar que salgamos de la pagina de login
    await this.page.waitForURL(url => !url.toString().includes('/log-in'), { timeout: 15000 });
  }
}