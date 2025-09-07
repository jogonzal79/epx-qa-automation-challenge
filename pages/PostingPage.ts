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

    // ✅ Selector corregido con .or()
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
  
  // ✅ MÉTODO MEJORADO: Lógica de análisis mejorada
  private async analyzeNavigationResult(): Promise<PostingResult> {
    console.log('🔄 Analizando resultado de la navegación...');
    
    // 🔧 MEJORA 1: Esperar más tiempo y validar múltiples veces
    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`📍 Análisis intento ${attempt}/3`);
      
      // Esperar que la página se estabilice
      const waitTime = attempt === 1 ? 4000 : 2000;
      await this.page.waitForTimeout(waitTime);
      
      const currentUrl = this.page.url();
      console.log(`📍 URL en intento ${attempt}: ${currentUrl}`);

      // 🔧 MEJORA 2: Detección de límites mejorada con más casos
      
      // Caso 1: URL indica pago/upgrade
      if (currentUrl.includes('?pay=advice') || 
          currentUrl.includes('upgrade') || 
          currentUrl.includes('/achieve?pay=')) {
        console.log('✅ Detectado límite por URL de pago/upgrade.');
        return {
          success: false,
          type: 'payment_required',
          message: 'Límite detectado a través de la URL.'
        };
      }
      
      // Caso 2: Verificar modales de límite (mejorado)
      const limitModal = await this.checkForLimitModal();
      if (limitModal.found) {
        return limitModal.result;
      }
      
      // Caso 3: Formulario gratuito disponible
      if (currentUrl.includes('seek-advice') && !currentUrl.includes('?pay=')) {
        const formVisible = await this.accountingFinanceRadio.isVisible({ timeout: 3000 }).catch(() => false);
        if (formVisible) {
          console.log('✅ Navegación exitosa al formulario gratuito.');
          return {
            success: true,
            type: 'free',
            message: 'Formulario Get Advice disponible gratuitamente'
          };
        }
      }
      
      // 🔧 MEJORA 3: Casos adicionales para detectar límites
      
      // Caso 4: Verificar si estamos en una página de membresía/upgrade
      const upgradeIndicators = [
        'text=/membership/i',
        'text=/subscription/i', 
        'text=/premium/i',
        'button:has-text("Subscribe")',
        'button:has-text("Upgrade Now")'
      ];
      
      for (const indicator of upgradeIndicators) {
        const element = this.page.locator(indicator);
        if (await element.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log(`✅ Detectado indicador de upgrade: ${indicator}`);
          return {
            success: false,
            type: 'upgrade_required',
            message: 'Página de upgrade/membresía detectada'
          };
        }
      }
      
      // Caso 5: Verificar si el botón Get Advice sigue visible (indicador de que no pasó nada)
      const getAdviceStillVisible = await this.getAdviceButton.isVisible({ timeout: 1000 }).catch(() => false);
      if (getAdviceStillVisible && attempt < 3) {
        console.log(`⚠️ Botón Get Advice aún visible en intento ${attempt}, reintentando...`);
        continue; // Probar siguiente intento
      }
    }
    
    // 🔧 MEJORA 4: Último recurso - análisis más exhaustivo
    console.log('🔍 Realizando análisis exhaustivo como último recurso...');
    
    const currentUrl = this.page.url();
    
    // Verificar si hay algún contenido que indique restricción
    const restrictionTexts = [
      'limit',
      'restrict',
      'upgrade',
      'premium',
      'subscribe',
      '$29',
      'pay',
      'billing'
    ];
    
    const pageContent = await this.page.content();
    const lowerContent = pageContent.toLowerCase();
    
    for (const text of restrictionTexts) {
      if (lowerContent.includes(text)) {
        console.log(`✅ Detectado texto de restricción: "${text}"`);
        return {
          success: false,
          type: text.includes('upgrade') || text.includes('premium') ? 'upgrade_required' : 'payment_required',
          message: `Restricción detectada por contenido de página (${text})`
        };
      }
    }
    
    // 🔧 MEJORA 5: Si llegamos aquí, proporcionar más información para debugging
    console.log(`⚠️ No se pudo determinar el estado después de 3 intentos.`);
    console.log(`   URL final: ${currentUrl}`);
    
    // Verificar si al menos hay algún formulario
    const hasAnyForm = await this.page.locator('form, input, textarea').isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`   ¿Hay formularios visibles?: ${hasAnyForm}`);
    
    // Screenshot para debugging
    await this.page.screenshot({
      path: `test-results/posting-analysis-error-${Date.now()}.png`,
      fullPage: true
    });
    
    return {
      success: false,
      type: 'error',
      message: `Estado indeterminado después del clic en Get Advice. URL: ${currentUrl}`
    };
  }

  // ✅ MÉTODO MEJORADO: Verificación de límites más exhaustiva
  private async checkForLimitModal(): Promise<{ found: boolean; result: PostingResult }> {
    console.log('🔍 Verificando modales de límites...');
    
    // 🔧 Indicadores expandidos con más casos
    const limitIndicators = [
      { selector: 'text=/upgrade.*membership/i', type: 'upgrade_required' },
      { selector: 'text=/upgrade.*plan/i', type: 'upgrade_required' },
      { selector: 'text="$29"', type: 'payment_required' },
      { selector: 'text="$39"', type: 'payment_required' }, // Otros precios posibles
      { selector: 'text=/\$\d+/i', type: 'payment_required' }, // Cualquier precio
      { selector: 'text=/limit.*reached/i', type: 'limit_reached' },
      { selector: 'text=/limit.*exceeded/i', type: 'limit_reached' },
      { selector: 'text=/maximum.*reached/i', type: 'limit_reached' },
      { selector: 'button:has-text("Upgrade")', type: 'upgrade_required' },
      { selector: 'button:has-text("Upgrade Now")', type: 'upgrade_required' },
      { selector: 'button:has-text("Subscribe")', type: 'upgrade_required' },
      { selector: 'button:has-text("Pay")', type: 'payment_required' },
      { selector: 'button:has-text("Pay Now")', type: 'payment_required' },
      { selector: '[role="dialog"]:has-text("upgrade")', type: 'upgrade_required' },
      { selector: '[role="dialog"]:has-text("limit")', type: 'limit_reached' },
      { selector: '[role="dialog"]:has-text("$")', type: 'payment_required' }
    ];
    
    // 🔧 Verificar en dos rondas: primero elementos específicos, luego modales generales
    for (let round = 1; round <= 2; round++) {
      console.log(`🔍 Ronda ${round} de verificación de límites...`);
      
      for (const indicator of limitIndicators) {
        const element = this.page.locator(indicator.selector);
        const timeout = round === 1 ? 3000 : 1000; // Más tiempo en primera ronda
        
        if (await element.isVisible({ timeout }).catch(() => false)) {
          console.log(`✅ Detectado indicador de límite: ${indicator.type} (${indicator.selector})`);
          
          // Obtener texto para logging
          const text = await element.first().innerText().catch(() => '');
          console.log(`   Texto encontrado: "${text.slice(0, 100)}..."`);
          
          return {
            found: true,
            result: {
              success: false,
              type: indicator.type as any,
              message: `Modal/elemento de ${indicator.type} detectado: "${text.slice(0, 50)}..."`
            }
          };
        }
      }
      
      // Entre rondas, esperar un poco
      if (round === 1) {
        await this.page.waitForTimeout(1000);
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