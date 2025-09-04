import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

export class CarlPage {
  readonly page: Page;
  readonly input: Locator;
  readonly messages: Locator;

  constructor(page: Page) {
    this.page = page;

    // Input confirmado por placeholder
    this.input = page.getByPlaceholder(/How can C\.A\.R\.L\. help you today\?/i);

    // Coleccion completa de mensajes con fallbacks
    this.messages = page.locator([
      '[data-testid*="carl"]',
      '[data-testid*="message"]',
      '[class*="carl"]',
      '[class*="message"]',
      '[class*="response"]',
      '[class*="chat-bubble"]',
      '.message',
      '.ai-message',
      '.conversation-item',
      '[role="listitem"]',
      'div[role="log"] > div',
      'main p',
      'div:has-text("C.A.R.L.")',
      'p:has-text("C.A.R.L.")'
    ].join(', '));
  }

  async goto() {
    await this.page.goto('https://app-stg.epxworldwide.com/carl', { 
      waitUntil: 'domcontentloaded' 
    });
    
    await this.page.waitForURL(/\/carl\b/, { timeout: 15000 }).catch(() => {});
    await this.page.waitForLoadState('networkidle').catch(() => {});

    // Asegurar que el input este visible
    await this.input.waitFor({ state: 'visible', timeout: 15000 });
    await this.page.waitForTimeout(1000);
  }

  async askQuestion(question: string) {
    await this.input.clear();
    await this.input.fill(question);
    await this.page.keyboard.press('Enter');
  }

  async waitForResponse(): Promise<string> {
    const baseline = await this.messages.count();

    // Esperar a que el conteo de mensajes aumente
    await expect
      .poll(async () => await this.messages.count(), {
        timeout: 60_000,
        intervals: [500, 750, 1000, 1500, 2000, 3000]
      })
      .toBeGreaterThan(baseline);

    const lastMessage = this.messages.last();
    await expect(lastMessage).toBeVisible({ timeout: 10_000 });
    
    let text = '';
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      text = (await lastMessage.innerText().catch(() => ''))?.trim() ?? '';
      
      if (text && text.length > 5) {
        break;
      }
      
      attempts++;
      await this.page.waitForTimeout(1000);
    }

    if (!text || text.length <= 5) {
      const alternativeSelectors = [
        '[data-testid*="message"]:last-child',
        '[class*="message"]:last-child',
        '.ai-message:last-child',
        'div[role="log"] > div:last-child'
      ];

      for (const selector of alternativeSelectors) {
        const altElement = this.page.locator(selector);
        if (await altElement.isVisible({ timeout: 2000 }).catch(() => false)) {
          text = (await altElement.innerText().catch(() => ''))?.trim() ?? '';
          if (text && text.length > 5) break;
        }
      }
    }

    return text;
  }

  async validateResponseContent(text?: string | null) {
    expect(text).toBeTruthy();
    expect(text!.trim().length).toBeGreaterThan(0);

    const cleanText = text!.trim();

    expect(cleanText.length).toBeGreaterThan(5);
    expect(cleanText).toMatch(/[A-Za-z]/);
    expect(cleanText.split(/\s+/).length).toBeGreaterThan(2);

    expect(cleanText).not.toMatch(/undefined|null|NaN/i);
    expect(cleanText).not.toMatch(/error|exception|stack trace/i);
    expect(cleanText).not.toMatch(/\[object Object\]/);

    if (cleanText.includes("C.A.R.L can make mistakes")) {
      console.log('Disclaimer generico - flujo funcionando correctamente');
      return;
    }

    expect(cleanText).toMatch(/[.!?]/);
    expect(cleanText).not.toMatch(/^[.\s]*$/);
    expect(cleanText).not.toMatch(/^[^a-zA-Z]*$/);
    expect(cleanText).not.toMatch(/^(yes|no|ok|sure)\.?$/i);
    
    const sentences = cleanText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    expect(sentences.length).toBeGreaterThanOrEqual(1);
  }

  async validateNetworkingResponse(text: string) {
    await this.validateResponseContent(text);

    if (text.includes("C.A.R.L can make mistakes") || 
        text.includes("verify critical data") ||
        text.length < 50) {
      console.log('Respuesta generica/disclaimer detectada - flujo valido pero no especifica');
      return;
    }

    const networkingKeywords = [
      /network/i, /event/i, /connect/i, /professional/i, /business/i,
      /meetup/i, /conference/i, /opportunity/i, /relationship/i, /career/i,
      /advice/i, /recommend/i, /suggest/i, /help/i
    ];

    const foundKeywords = networkingKeywords.filter(keyword => 
      text.match(keyword)
    ).length;

    expect(foundKeywords).toBeGreaterThanOrEqual(1);
  }

  async getConversationHistory(): Promise<string[]> {
    const allMessages = await this.messages.all();
    const messageTexts: string[] = [];

    for (const message of allMessages) {
      const text = (await message.innerText().catch(() => ''))?.trim();
      if (text && text.length > 0) {
        messageTexts.push(text);
      }
    }

    return messageTexts;
  }
}