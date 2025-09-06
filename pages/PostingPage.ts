// pages/PostingPage.ts
import type { Page, Locator } from '@playwright/test';
import { ModalHandler } from '../helpers/ModalHandler.js';

export interface PostingResult {
  success: boolean;
  type: 'free' | 'upgrade_required' | 'payment_required' | 'limit_reached' | 'error';
  message?: string;
}

export class PostingPage {
  private page: Page;
  private modalHandler: ModalHandler;
  
  // Selectores principales - TODOS definidos aquí
  readonly getAdviceButton: Locator;
  readonly accountingFinanceRadio: Locator;
  readonly descriptionEditor: Locator;
  readonly submitButton: Locator;
  readonly continueButton: Locator;
  readonly wayToGoHeading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.modalHandler = new ModalHandler(page);
    
    // Inicializar TODOS los locators
    this.getAdviceButton = page.getByRole('button', { name: 'Get Advice' });
    this.accountingFinanceRadio = page.getByRole('radio', { name: 'Accounting/Finance' });
    this.descriptionEditor = page.getByRole('textbox', { name: 'rdw-editor' });
    this.submitButton = page.getByRole('button', { name: 'Submit' });
    this.continueButton = page.getByRole('button', { name: 'Continue' });

    // ✅ SOLUCIÓN 1: Selector corregido con .or()
    this.wayToGoHeading = page.locator('h1:has-text("Way to go")')
      .or(page.locator('h2:has-text("Way to go")'))
      .or(page.getByText(/way.*to.*go/i));
  }

  async goto(): Promise<void> {
    // NO refrescar si ya estamos en la página principal
    const currentUrl = this.page.url();
    if (!currentUrl.includes('app-stg.epxworldwide.com')) {
      await this.page.goto('https://app-stg.epxworldwide.com/', {
        waitUntil: 'networkidle',
        timeout: 30000
      });
    }
    await this.waitForPageToLoad();
  }

  async waitForPageToLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(2000);
    
    const url = this.page.url();
    console.log(`Current URL: ${url}`);
    
    if (url.includes('sign-in') || url.includes('login')) {
      throw new Error('Usuario no autenticado - redirigido a login');
    }
  }

  async clickGetAdvice(): Promise<PostingResult> {
    try {
      console.log('🔍 Preparando para hacer clic en Get Advice...');
      
      console.log('🎯 Buscando botón Get Advice...');
      
      const isVisible = await this.getAdviceButton.isVisible({ timeout: 5000 });
      
      if (!isVisible) {
        console.log('⚠️ Botón no visible, intentando hacer scroll...');
        await this.page.evaluate(() => window.scrollTo(0, 0));
        await this.page.waitForTimeout(1000);
      }
      
      await this.getAdviceButton.waitFor({ state: 'visible', timeout: 10000 });
      console.log('✅ Botón Get Advice encontrado');
      
      await this.getAdviceButton.click();
      console.log('✅ Clic en Get Advice realizado');
      
      return await this.analyzeNavigationResult();
      
    } catch (error) {
      console.error('❌ Error al hacer clic en Get Advice:', error);
      
      await this.page.screenshot({
        path: `test-results/get-advice-error-${Date.now()}.png`,
        fullPage: true
      });
      
      const limitModal = await this.checkForLimitModal();
      if (limitModal.found) {
        return limitModal.result;
      }
      
      return {
        success: false,
        type: 'error',
        message: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }
  
  // ✅ SOLUCIÓN 2: Lógica de análisis mejorada
  private async analyzeNavigationResult(): Promise<PostingResult> {
    console.log('🔄 Analizando resultado de la navegación...');
    
    // Esperar un momento para que la página responda y la URL se estabilice
    await this.page.waitForTimeout(4000);
    
    const currentUrl = this.page.url();
    console.log(`📍 URL después del clic: ${currentUrl}`);

    // Condición 1: Límite alcanzado (página de pago, upgrade o modal)
    const limitModal = await this.checkForLimitModal();
    if (limitModal.found) {
      return limitModal.result;
    }
    
    if (currentUrl.includes('?pay=advice') || currentUrl.includes('upgrade')) {
      console.log('✅ Detectado límite por URL de pago/upgrade.');
      return {
        success: false,
        type: 'payment_required', // Se asume pago, pero podría ser upgrade
        message: 'Límite detectado a través de la URL.'
      };
    }

    // Condición 2: Formulario gratuito (éxito)
    if (currentUrl.includes('seek-advice') && !currentUrl.includes('?pay=')) {
      const formVisible = await this.accountingFinanceRadio.isVisible({ timeout: 5000 }).catch(() => false);
      if (formVisible) {
        console.log('✅ Navegación exitosa al formulario gratuito.');
        return {
          success: true,
          type: 'free',
          message: 'Formulario Get Advice disponible gratuitamente'
        };
      }
    }
    
    console.log('⚠️ No se pudo determinar el estado. Ni formulario gratuito ni modal/página de límite encontrados.');
    return {
      success: false,
      type: 'error',
      message: 'Estado indeterminado después del clic en Get Advice'
    };
  }


  private async checkForLimitModal(): Promise<{ found: boolean; result: PostingResult }> {
    console.log('🔍 Verificando modales de límites...');
    
    const limitIndicators = [
      { selector: 'text=/upgrade.*membership/i', type: 'upgrade_required' },
      { selector: 'text="$29"', type: 'payment_required' },
      { selector: 'text=/limit.*reached/i', type: 'limit_reached' },
      { selector: 'button:has-text("Upgrade")', type: 'upgrade_required' },
      { selector: 'button:has-text("Pay")', type: 'payment_required' }
    ];
    
    for (const indicator of limitIndicators) {
      const element = this.page.locator(indicator.selector);
      if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log(`✅ Detectado indicador de límite: ${indicator.type}`);
        
        return {
          found: true,
          result: {
            success: false,
            type: indicator.type as any,
            message: `Modal de ${indicator.type} detectado`
          }
        };
      }
    }
    
    return { found: false, result: { success: false, type: 'error' } };
  }

  async fillAndSubmitAdviceForm(description: string): Promise<boolean> {
    try {
      console.log('📝 Completando formulario Get Advice...');
      
      await this.accountingFinanceRadio.waitFor({ state: 'visible', timeout: 10000 });
      await this.accountingFinanceRadio.check();
      console.log('✅ Categoría Accounting/Finance seleccionada');
      
      const textPrompt = this.page.getByText('Write 4 sentences describing');
      if (await textPrompt.isVisible({ timeout: 2000 })) {
        await textPrompt.click();
      }
      
      await this.descriptionEditor.waitFor({ state: 'visible', timeout: 10000 });
      await this.descriptionEditor.fill(description);
      console.log('✅ Descripción completada');
      
      await this.submitButton.click();
      console.log('🚀 Formulario enviado');
      
      await this.handlePostSubmissionModal();
      
      return true;
      
    } catch (error) {
      console.error('❌ Error al completar formulario:', error);
      return false;
    }
  }

  private async handlePostSubmissionModal(): Promise<void> {
    try {
      console.log('⏳ Esperando modal de confirmación...');
      
      const continueVisible = await this.continueButton.isVisible({ timeout: 10000 });
      
      if (continueVisible) {
        console.log('📍 Modal de confirmación detectado');
        await this.continueButton.click();
        console.log('✅ Clic en Continue - Formulario completado exitosamente');
      } else {
        const successVisible = await this.wayToGoHeading.isVisible({ timeout: 5000 });
        
        if (successVisible) {
          console.log('✅ Mensaje "Way to go" detectado - éxito confirmado');
          return;
        }
        
        const successIndicators = [
          this.page.locator('text=/success/i'),
          this.page.locator('text=/thank/i'),
          this.page.locator('text=/submitted/i')
        ];
        
        for (const indicator of successIndicators) {
          if (await indicator.isVisible({ timeout: 2000 })) {
            console.log('✅ Indicador de éxito detectado');
            return;
          }
        }
        
        console.log('⚠️ No se detectó confirmación clara, pero continuando...');
      }
    } catch (error) {
      console.log('⚠️ Error manejando modal post-envío:', error);
    }
  }
  
  async navigateDirectlyToAdviceForm(): Promise<void> {
    console.log('📍 Navegando directamente al formulario Get Advice...');
    await this.page.goto('https://app-stg.epxworldwide.com/achieve/seek-advice', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    await this.waitForPageToLoad();
  }
}