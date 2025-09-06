// helpers/VisualTestHelper.ts
import type { Page, Locator } from '@playwright/test';

export class VisualTestHelper {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Navega a la página de C.A.R.L. y espera a que esté estable para la captura.
   */
  async setupCarlPageForSnapshot(): Promise<void> {
    await this.page.goto('/carl');
    await this.page.waitForSelector('textarea[placeholder="How can C.A.R.L. help you today?"]');
    await this.page.waitForTimeout(1500); // Espera para que las animaciones terminen
  }

  /**
   * Realiza los pasos para mostrar el modal de límite de publicación y lo devuelve.
   * @returns {Promise<Locator>} El locator del modal listo para ser capturado.
   */
  async setupPostingLimitModalForSnapshot(): Promise<Locator> {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');

    // Asumimos que el usuario de prueba ya ha alcanzado sus límites
    await this.page.getByRole('button', { name: 'Get Advice' }).click();

    const modal = this.page.locator('[role="dialog"]');
    await modal.waitFor({ state: 'visible', timeout: 10000 });
    await this.page.waitForTimeout(1000); // Espera para el renderizado final del modal

    return modal;
  }
}