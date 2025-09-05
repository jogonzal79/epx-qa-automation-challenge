import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from './BasePage.js';

export class LoginPage extends BasePage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitBtn: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = this.page
      .getByRole('textbox', { name: 'example@email.com' })
      .or(this.page.locator('input[type="email"], input[name="email"]'));

    this.passwordInput = this.page
      .getByRole('textbox', { name: /password/i })
      .or(this.page.locator('input[type="password"], input[name="password"]'));

    this.submitBtn = this.page
      .getByRole('button', { name: /login/i, exact: false })
      .or(this.page.locator('button[type="submit"], button:has-text("Log in"), button:has-text("LOGIN")'));
  }

  async goto() {
    await super.goto('/log-in');

    const emailVisible = await this.emailInput.first().isVisible().catch(() => false);
    const passVisible = await this.passwordInput.first().isVisible().catch(() => false);
    if (emailVisible && passVisible) {
      await expect(this.emailInput).toBeVisible({ timeout: 15000 });
      await expect(this.passwordInput).toBeVisible({ timeout: 15000 });
      return;
    }

    // ya autenticado
    const authIndicator = this.page.locator('a[href="/carl"], header, [role="navigation"]');
    await authIndicator.first().isVisible().catch(() => {});
  }

  async fillCredentials(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
  }

  async submitLogin() {
    await this.submitBtn.click();
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }
}
