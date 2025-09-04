import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

export abstract class BasePage {
  readonly page: Page;
  readonly baseURL: string = 'https://app-stg.epxworldwide.com';

  constructor(page: Page) {
    this.page = page;
  }

  // Navegacion base con esperas robustas
  async goto(path: string = '') {
    const fullURL = path.startsWith('http') ? path : `${this.baseURL}${path}`;
    
    await this.page.goto(fullURL, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await this.page.waitForTimeout(1000); // Estabilizacion
  }

  // Esperas comunes reutilizables
  async waitForElement(locator: Locator, options?: { timeout?: number }) {
    await locator.waitFor({ 
      state: 'visible', 
      timeout: options?.timeout || 15000 
    });
  }

  async waitForElementToBeHidden(locator: Locator, options?: { timeout?: number }) {
    await locator.waitFor({ 
      state: 'hidden', 
      timeout: options?.timeout || 15000 
    });
  }

  // Metodos de interaccion seguros
  async safeClick(locator: Locator) {
    await this.waitForElement(locator);
    await locator.click();
  }

  async safeFill(locator: Locator, text: string) {
    await this.waitForElement(locator);
    await locator.clear();
    await locator.fill(text);
  }

  async safeSelect(locator: Locator, option: string) {
    await this.waitForElement(locator);
    await locator.selectOption(option);
  }

  // Validaciones comunes
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
      'text=/error/i'
    ];

    for (const selector of errorSelectors) {
      const errorElement = this.page.locator(selector);
      if (await errorElement.isVisible({ timeout: 2000 }).catch(() => false)) {
        const errorText = await errorElement.innerText();
        throw new Error(`Error message found: ${errorText}`);
      }
    }
  }

  // Utilidades de debugging
  async takeDebugScreenshot(name: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await this.page.screenshot({ 
      path: `test-results/debug-${name}-${timestamp}.png`,
      fullPage: true 
    });
  }

  async logCurrentURL() {
    console.log(`Current URL: ${this.page.url()}`);
  }

  async logPageTitle() {
    const title = await this.page.title();
    console.log(`Page title: ${title}`);
  }

  // Manejo de loading states
  async waitForLoadingToComplete() {
    const loadingSelectors = [
      '[data-testid*="loading"]',
      '[class*="loading"]',
      '[class*="spinner"]',
      '.loader',
      'text=/loading/i',
      'text=/cargando/i'
    ];

    for (const selector of loadingSelectors) {
      const loadingElement = this.page.locator(selector);
      if (await loadingElement.isVisible({ timeout: 2000 }).catch(() => false)) {
        await this.waitForElementToBeHidden(loadingElement, { timeout: 30000 });
      }
    }
  }

  // Manejo de modales
  async closeModalIfVisible() {
    const modalCloseSelectors = [
      '[data-testid*="close"]',
      '.modal-close',
      'button:has-text("Close")',
      'button:has-text("×")',
      '.close',
      '[aria-label*="close"]'
    ];

    for (const selector of modalCloseSelectors) {
      const closeButton = this.page.locator(selector);
      if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeButton.click();
        break;
      }
    }
  }

  // Navegacion comun de EPX
  async goToLogin() {
    await this.goto('/log-in');
    await this.validatePageLoaded('/log-in');
  }

  async goToDashboard() {
    await this.goto('/');
    await this.waitForLoadingToComplete();
  }

  async goToCarl() {
    await this.goto('/carl');
    await this.validatePageLoaded('/carl');
  }

  async goToAdviceForm() {
    await this.goto('/achieve/seek-advice');
    await this.waitForLoadingToComplete();
  }

  async goToOnlineEvents() {
    await this.goto('/online');
    await this.waitForLoadingToComplete();
  }

  // Validacion de autenticacion (opcional)
  async validateAuthenticated(required: boolean = true) {
    // Esperar a que aparezcan elementos del usuario autenticado
    const authIndicators = [
      'nav',
      '[data-testid*="user"]',
      '[data-testid*="profile"]',
      'header',
      '[role="navigation"]'
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

  // Limpieza y reset
  async clearAllInputs() {
    const inputs = await this.page.locator('input[type="text"], input[type="email"], textarea').all();
    for (const input of inputs) {
      if (await input.isVisible().catch(() => false)) {
        await input.clear();
      }
    }
  }

  async refreshPage() {
    await this.page.reload({ waitUntil: 'networkidle' });
    await this.waitForLoadingToComplete();
  }
}