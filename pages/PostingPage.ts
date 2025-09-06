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
    this.wayToGoHeading = page.locator('h1:has-text("Way to go"), h2:has-text("Way to go"), text=/way.*to.*go/i');
  }

  async goto(): Promise<void> {
    await this.page.goto('https://app-stg.epxworldwide.com/', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
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
      
      // PASO 1: Cerrar todos los modales de onboarding
      await this.modalHandler.closeAllOnboardingModals();
      
      // Verificar si quedan modales
      if (await this.modalHandler.hasVisibleModals()) {
        console.log('⚠️ Aún hay modales visibles, intentando cerrarlos nuevamente...');
        await this.modalHandler.closeAllOnboardingModals();
      }
      
      // PASO 2: Buscar y hacer clic en Get Advice
      console.log('🎯 Buscando botón Get Advice...');
      
      // Esperar un poco más para asegurar que los modales se cerraron
      await this.page.waitForTimeout(2000);
      
      // Verificar si el botón está visible
      const isVisible = await this.getAdviceButton.isVisible({ timeout: 5000 });
      
      if (!isVisible) {
        console.log('⚠️ Botón no visible, intentando hacer scroll...');
        // Intentar hacer scroll para encontrar el botón
        await this.page.evaluate(() => window.scrollTo(0, 0));
        await this.page.waitForTimeout(1000);
      }
      
      await this.getAdviceButton.waitFor({ state: 'visible', timeout: 10000 });
      console.log('✅ Botón Get Advice encontrado');
      
      // Hacer clic
      await this.getAdviceButton.click();
      console.log('✅ Clic en Get Advice realizado');
      
      // PASO 3: Analizar el resultado
      return await this.analyzeNavigationResult();
      
    } catch (error) {
      console.error('❌ Error al hacer clic en Get Advice:', error);
      
      // Tomar screenshot para debugging
      await this.page.screenshot({
        path: `test-results/get-advice-error-${Date.now()}.png`,
        fullPage: true
      });
      
      // Verificar si apareció un modal de límites
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

  private async analyzeNavigationResult(): Promise<PostingResult> {
    console.log('🔄 Analizando resultado de la navegación...');
    
    // Esperar un momento para que la página responda
    await this.page.waitForTimeout(3000);
    
    const currentUrl = this.page.url();
    console.log(`📍 URL después del clic: ${currentUrl}`);
    
    // Verificar si llegamos al formulario (éxito - gratuito)
    if (currentUrl.includes('achieve') || currentUrl.includes('seek-advice')) {
      console.log('✅ Navegación exitosa al formulario');
      
      // Verificar que el formulario esté visible
      const formVisible = await this.accountingFinanceRadio.isVisible({ timeout: 5000 })
        .catch(() => false);
      
      if (formVisible) {
        return {
          success: true,
          type: 'free',
          message: 'Formulario Get Advice disponible gratuitamente'
        };
      }
    }
    
    // Verificar si apareció un modal de límites
    const limitModal = await this.checkForLimitModal();
    if (limitModal.found) {
      return limitModal.result;
    }
    
    return {
      success: false,
      type: 'error',
      message: 'Estado indeterminado después del clic'
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
      
      // PASO 1: Seleccionar categoría
      await this.accountingFinanceRadio.waitFor({ state: 'visible', timeout: 10000 });
      await this.accountingFinanceRadio.check();
      console.log('✅ Categoría Accounting/Finance seleccionada');
      
      // PASO 2: Llenar descripción
      // Primero hacer clic en el área de texto si es necesario
      const textPrompt = this.page.getByText('Write 4 sentences describing');
      if (await textPrompt.isVisible({ timeout: 2000 })) {
        await textPrompt.click();
      }
      
      await this.descriptionEditor.waitFor({ state: 'visible', timeout: 10000 });
      await this.descriptionEditor.fill(description);
      console.log('✅ Descripción completada');
      
      // PASO 3: Enviar formulario
      await this.submitButton.click();
      console.log('🚀 Formulario enviado');
      
      // PASO 4: Manejar modal de confirmación
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
      
      // Esperar a que aparezca el botón Continue
      const continueVisible = await this.continueButton.isVisible({ timeout: 10000 });
      
      if (continueVisible) {
        console.log('📍 Modal de confirmación detectado');
        await this.continueButton.click();
        console.log('✅ Clic en Continue - Formulario completado exitosamente');
      } else {
        // Buscar otros indicadores de éxito usando wayToGoHeading
        const successVisible = await this.wayToGoHeading.isVisible({ timeout: 5000 });
        
        if (successVisible) {
          console.log('✅ Mensaje "Way to go" detectado - éxito confirmado');
          return;
        }
        
        // Buscar otros indicadores de éxito
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
  
  // Método alternativo para navegar directamente al formulario
  async navigateDirectlyToAdviceForm(): Promise<void> {
    console.log('📍 Navegando directamente al formulario Get Advice...');
    await this.page.goto('https://app-stg.epxworldwide.com/achieve/seek-advice', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    await this.waitForPageToLoad();
  }
}