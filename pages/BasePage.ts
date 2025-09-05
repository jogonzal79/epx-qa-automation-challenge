import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

export abstract class BasePage {
  readonly page: Page;
  readonly baseURL: string = 'https://app-stg.epxworldwide.com';

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Núcleo de navegación "final".
   * No debe ser sobreescrito. Los helpers internos lo usarán para evitar recursión.
   */
  protected async _open(path: string = '') {
    const fullURL = path.startsWith('http') ? path : `${this.baseURL}${path}`;

    await this.page.goto(fullURL, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await this.page.waitForTimeout(1000); // Estabilización
  }

  /**
   * API pública de navegación. Subclases pueden sobreescribirla si lo necesitan.
   * Por defecto delega en _open.
   */
  async goto(path: string = '') {
    await this._open(path);
  }

  // -------------------- Esperas comunes --------------------
  async waitForElement(locator: Locator, options?: { timeout?: number }) {
    await locator.waitFor({
      state: 'visible',
      timeout: options?.timeout ?? 15000,
    });
  }

  async waitForElementToBeHidden(locator: Locator, options?: { timeout?: number }) {
    await locator.waitFor({
      state: 'hidden',
      timeout: options?.timeout ?? 15000,
    });
  }

  // -------------------- Interacciones seguras --------------------
  async safeClick(locator: Locator) {
    await this.waitForElement(locator);
    await locator.click();
  }

  async safeFill(locator: Locator, text: string) {
    await this.waitForElement(locator);
    await locator.clear().catch(() => {});
    await locator.fill(text);
  }

  async safeSelect(locator: Locator, option: string) {
    await this.waitForElement(locator);
    await locator.selectOption(option);
  }

  // -------------------- Validaciones comunes --------------------
  async validatePageLoaded(identifier: Locator | string) {
    if (typeof identifier === 'string') {
      await expect(this.page).toHaveURL(new RegExp(identifier));
    } else {
      await expect(identifier).toBeVisible({ timeout: 15000 });
    }
  }

  async validateNoErrorMessages() {
    const errorSelectors = [
      '[role="alert"]',
      '.error',
      '.alert-error',
      '[class*="error"]',
      '.notification-error',
      'text=/error/i',
    ];

    for (const selector of errorSelectors) {
      const errorElement = this.page.locator(selector);
      if (await errorElement.isVisible({ timeout: 2000 }).catch(() => false)) {
        const errorText = await errorElement.innerText();
        throw new Error(`Error message found: ${errorText}`);
      }
    }
  }

  // -------------------- Utilidades de debugging --------------------
  async takeDebugScreenshot(name: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await this.page.screenshot({
      path: `test-results/debug-${name}-${timestamp}.png`,
      fullPage: true,
    });
  }

  async logCurrentURL() {
    console.log(`Current URL: ${this.page.url()}`);
  }

  async logPageTitle() {
    const title = await this.page.title();
    console.log(`Page title: ${title}`);
  }

  // -------------------- Loading states --------------------
  async waitForLoadingToComplete() {
    const loadingSelectors = [
      '[data-testid*="loading"]',
      '[class*="loading"]',
      '[class*="spinner"]',
      '.loader',
      '[aria-busy="true"]',
      '[role="progressbar"]',
      'text=/loading/i',
      'text=/cargando/i',
    ];

    for (const selector of loadingSelectors) {
      const loadingElement = this.page.locator(selector);
      if (await loadingElement.isVisible({ timeout: 2000 }).catch(() => false)) {
        await this.waitForElementToBeHidden(loadingElement, { timeout: 30000 });
      }
    }
  }

  // -------------------- Navegación común EPX --------------------
  // IMPORTANTE: usar _open(...) para evitar polimorfismo si una subclase sobreescribe goto()
  async goToLogin() {
    await this._open('/log-in');
    await this.validatePageLoaded('/log-in');
  }

  async goToDashboard() {
    await this._open('/');
    await this.waitForLoadingToComplete();
  }

  async goToCarl() {
    await this._open('/carl');
    await this.validatePageLoaded('/carl');
  }

  async goToAdviceForm() {
    await this._open('/achieve/seek-advice');
    await this.waitForLoadingToComplete();
  }

  async goToOnlineEvents() {
    await this._open('/online');
    await this.waitForLoadingToComplete();
  }

  // -------------------- Autenticación --------------------
  async validateAuthenticated(required: boolean = true) {
    const authIndicators = [
      'a[href="/carl"]',
      '[data-testid*="user"]',
      '[data-testid*="profile"]',
      'header',
      '[role="navigation"]',
    ];

    let isAuthenticated = false;
    for (const selector of authIndicators) {
      const element = this.page.locator(selector);
      if (await element.isVisible({ timeout: 5000 }).catch(() => false)) {
        isAuthenticated = true;
        break;
      }
    }

    if (!isAuthenticated && required) {
      throw new Error('User does not appear to be authenticated');
    }

    return isAuthenticated;
  }

  // -------------------- Limpieza / reset --------------------
  async clearAllInputs() {
    const inputs = await this.page
      .locator('input[type="text"], input[type="email"], textarea')
      .all();
    for (const input of inputs) {
      if (await input.isVisible().catch(() => false)) {
        await input.clear().catch(() => {});
      }
    }
  }

  async refreshPage() {
    await this.page.reload({ waitUntil: 'networkidle' });
    await this.waitForLoadingToComplete();
  }
}
