import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

export class CarlPage {
  readonly page: Page;
  readonly input: Locator;
  readonly messages: Locator; // colección de mensajes (user + IA)

  constructor(page: Page) {
    this.page = page;

    // Input confirmado por placeholder en tu captura
    this.input = page.getByPlaceholder(/How can C\.A\.R\.L\. help you today\?/i);

    // Colección de mensajes (probamos patrones comunes y roles accesibles)
    this.messages = page.locator([
      // intenta data-testids/clases típicos
      '[data-testid*="message"]',
      '[class*="message"]',
      '.message',
      '.ai-message',
      // fallback accesible: listas de items en el hilo
      '[role="listitem"]',
      // último recurso: cualquier párrafo dentro del panel central de chat
      'main p'
    ].join(', '));
  }

  async goto() {
    await this.page.goto('https://app-stg.epxworldwide.com/carl', { waitUntil: 'domcontentloaded' });
    await this.page.waitForURL(/\/carl\b/, { timeout: 15000 }).catch(() => {});
    await this.page.waitForLoadState('networkidle').catch(() => {});

    // Asegura que el input esté visible: ancla fiable de que cargó el chat
    await this.input.waitFor({ state: 'visible', timeout: 15000 });
  }

  async askQuestion(question: string) {
    await this.input.fill(question);
    await this.page.keyboard.press('Enter');
  }

  /**
   * Espera a que aparezca al menos UN mensaje nuevo en el hilo
   * y devuelve el texto del ÚLTIMO mensaje.
   */
  async waitForResponse() {
    const baseline = await this.messages.count();

    // Espera a que el conteo de mensajes aumente
    await expect
      .poll(async () => await this.messages.count(), {
        timeout: 60_000,           // CARL puede tardar
        intervals: [500, 750, 1000, 1500, 2000]
      })
      .toBeGreaterThan(baseline);

    const last = this.messages.last();

    // Asegura visibilidad y texto no vacío
    await expect(last).toBeVisible({ timeout: 10_000 }).catch(() => {});
    const text = (await last.innerText().catch(() => ''))?.trim() ?? '';

    // Si por cualquiera razón quedó vacío, intenta un par de hermanos cercanos
    if (!text) {
      const near = this.page.locator(
        '[data-testid*="message"], [class*="message"], .message, .ai-message'
      ).last();
      const nearText = (await near.innerText().catch(() => ''))?.trim() ?? '';
      return nearText || text; // uno de los dos
    }

    return text;
  }

  async validateResponseContent(text?: string | null) {
    expect(text && text.trim().length).toBeGreaterThan(10);
    expect(text!).toMatch(/[A-Za-z]/);
  }
}
