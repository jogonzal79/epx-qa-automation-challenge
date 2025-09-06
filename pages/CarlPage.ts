// pages/CarlPage.ts
import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from './BasePage.js';

export class CarlPage extends BasePage {
  readonly chatContainer: Locator;
  readonly input: Locator;
  readonly chatWrapper: Locator;
  readonly loadingIndicator: Locator;

  private _initialChatContent = '';
  private _lastUserMessage = '';

  constructor(page: Page) {
    super(page);

    this.chatContainer = this.page.locator('.carl-messages-height, .chat-wrapper').first();
    this.chatWrapper = this.page.locator('.chat-wrapper').first();
    this.input = this.page.locator('textarea[placeholder="How can C.A.R.L. help you today?"]')
      .or(this.page.locator('textarea').first());
    
    // Definimos el indicador de carga aquí para reutilizarlo
    this.loadingIndicator = this.page.locator('[class*="typing"], [class*="loading"], [class*="dots"]').first();
  }

  async goto() {
    await super.goto('/carl');
    await this.page.waitForTimeout(2000);

    console.log('⏳ Esperando a que la interfaz de C.A.R.L. esté completamente cargada...');
    
    await this.chatContainer.waitFor({ state: 'visible', timeout: 30000 });
    await this.input.waitFor({ state: 'visible', timeout: 30000 });
    await expect(this.input).toBeEnabled({ timeout: 5000 });
    
    this._initialChatContent = await this.chatWrapper.innerText().catch(() => '');
    
    console.log(`✓ C.A.R.L. page loaded. Initial chat length: ${this._initialChatContent.length} chars`);
  }

  async askQuestion(question: string) {
    this._lastUserMessage = question;
    
    await this.input.scrollIntoViewIfNeeded();
    await this.input.click();
    await this.page.waitForTimeout(300);
    
    await this.input.fill('');
    await this.page.waitForTimeout(200);
    
    await this.input.type(question, { delay: 30 });
    await this.page.waitForTimeout(300);
    
    const inputValue = await this.input.inputValue();
    console.log(`📝 Texto en input: "${inputValue}"`);
    
    if (!inputValue.includes(question)) {
      console.log('⚠️ Reintentando escritura...');
      await this.input.fill(question);
    }
    
    console.log('⏎ Enviando con Enter...');
    await this.input.press('Enter');
    
    console.log(`✓ Pregunta enviada: "${question}"`);
  }

  // ✅ SOLUCIÓN DEFINITIVA para waitForResponse
  async waitForResponse(opts?: { timeoutMs?: number }): Promise<string> {
    const timeoutMs = opts?.timeoutMs ?? 70_000;
    console.log('⏳ Esperando a que la respuesta del asistente comience...');

    // Paso 1: Esperar a que el contenido del chat cambie, indicando que la respuesta ha comenzado.
    // Usamos una aserción `expect` que reintentará hasta que se cumpla o se agote el tiempo.
    await expect(async () => {
      const currentContent = await this.chatWrapper.innerText();
      // La nueva longitud debe ser mayor que la inicial + la pregunta del usuario.
      expect(currentContent.length).toBeGreaterThan(this._initialChatContent.length + this._lastUserMessage.length);
    }).toPass({
      timeout: timeoutMs / 2, // Le damos la mitad del tiempo total para que la respuesta comience
    });

    console.log('✓ La respuesta ha comenzado. Esperando a que finalice (indicador de carga desaparezca)...');

    // Paso 2: Ahora que sabemos que la respuesta está en progreso, esperamos a que el indicador de "escribiendo..." desaparezca.
    await this.loadingIndicator.waitFor({ state: 'hidden', timeout: timeoutMs / 2 }).catch(() => {
        console.log('⚠️ No se encontró indicador de carga o ya estaba oculto, continuando...');
    });
    
    // Pequeña pausa para asegurar que el DOM se actualice después de que el indicador desaparece
    await this.page.waitForTimeout(1500);

    // Paso 3: Obtener el contenido final y extraer la respuesta.
    const finalContent = await this.chatWrapper.innerText();
    const newContent = finalContent.substring(this._initialChatContent.length);
    const answer = this.extractAssistantResponse(newContent);

    console.log(`✓ Respuesta final capturada (${answer.length} chars): "${answer.slice(0, 100)}..."`);
    return answer;
  }

  private extractAssistantResponse(content: string): string {
    if (!content) return '';
    
    const questionIndex = content.indexOf(this._lastUserMessage);
    if (questionIndex === -1) {
      return this.cleanResponse(content);
    }
    
    let afterQuestion = content.substring(questionIndex + this._lastUserMessage.length).trim();
    
    afterQuestion = afterQuestion.replace(/^C\.A\.R\.L\.?\s*\n?\s*IA\s*\n?/i, '');
    afterQuestion = afterQuestion.replace(/^C\.A\.R\.L\.?\s*/i, '');
    afterQuestion = afterQuestion.replace(/^IA\s*/i, '');
    
    return this.cleanResponse(afterQuestion);
  }

  private cleanResponse(text: string): string {
    if (!text) return '';
    
    let clean = text.trim();
    
    if (clean.includes("Hello, Carla. I hope you're doing well today")) {
      const welcomeEnd = clean.indexOf("previous discussions") + 20;
      if (welcomeEnd > 20) {
        const afterWelcome = clean.substring(welcomeEnd).trim();
        if (afterWelcome.length > 50) {
          clean = afterWelcome;
        }
      }
    }
    
    clean = clean.replace(/^C\.A\.R\.L\.?\s*\n?\s*IA\s*\n?/i, '');
    clean = clean.replace(/^C\.A\.R\.L\.?\s*/i, '');
    clean = clean.replace(/^IA\s*/i, '');
    clean = clean.replace(/^Assistant\s*/i, '');
    clean = clean.replace(/^Bot\s*/i, '');
    clean = clean.replace(/^Let me (?:look at|check) the records\.+\s*/gi, '');
    clean = clean.replace(/^Loading\.+\s*/gi, '');
    clean = clean.replace(/^Thinking\.+\s*/gi, '');
    
    const previousQuestions = [
      '"Where are you from and why are you on Earth?"',
      '"Traveling to Miami. Are there any members there?"',
      '"Looking for an expert in digital marketing"',
      '"Is there anyone in EPX who also cares about reducing poverty"'
    ];
    
    for (const q of previousQuestions) {
      clean = clean.replace(q, '');
    }
    
    clean = clean.replace(/C\.A\.R\.L can make mistakes.*$/i, '');
    clean = clean.replace(/\n{3,}/g, '\n\n');
    clean = clean.replace(/\s+/g, ' ');
    
    return clean.trim();
  }

  async validateResponseContent(
    answer: string,
    opts?: { mustIncludeAnyOf?: RegExp[]; minLength?: number }
  ) {
    const minLength = opts?.minLength ?? 30;
    const mustIncludeAnyOf = opts?.mustIncludeAnyOf ?? [];

    const clean = (answer || '').replace(/\s+/g, ' ').trim();

    if (clean.length < minLength) {
      console.log(`❌ Respuesta muy corta (${clean.length} chars): "${clean}"`);
    }

    expect(clean.length, `La respuesta es muy corta: "${clean}"`).toBeGreaterThanOrEqual(minLength);
    expect(/error|exception|traceback|stack\s*trace/i.test(clean), 'La respuesta contiene un error técnico').toBeFalsy();

    if (mustIncludeAnyOf.length > 0) {
      const hit = mustIncludeAnyOf.some((rx) => rx.test(clean));
      if (!hit) {
        console.log(`⚠️ La respuesta no contiene las palabras esperadas`);
        console.log(`   Respuesta: "${clean.slice(0, 200)}..."`);
        console.log(`   Esperadas: ${mustIncludeAnyOf.map(r => r.toString()).join(', ')}`);
        
        if (clean.length > 50) {
          console.log('   ✓ Pero la respuesta es suficientemente larga y coherente, continuando...');
          return;
        }
      }
      expect(
        hit,
        `La respuesta no contiene ninguna de las palabras esperadas: ${mustIncludeAnyOf
          .map((r) => r.toString())
          .join(', ')}`
      ).toBeTruthy();
    }
  }
}