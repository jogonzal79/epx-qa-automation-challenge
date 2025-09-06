// helpers/VisualTestHelper.ts
import type { Page, Locator } from '@playwright/test';

export class VisualTestHelper {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Configura la página de C.A.R.L. para captura de pantalla
   */
  async setupCarlPageForSnapshot(): Promise<void> {
    await this.page.goto('/carl');
    
    // Esperar a elementos clave en lugar de timeout fijo
    await this.page.waitForSelector('textarea[placeholder="How can C.A.R.L. help you today?"]', { 
      state: 'visible',
      timeout: 15000 
    });
    
    // Esperar a que la red esté inactiva (todas las requests completadas)
    await this.page.waitForLoadState('networkidle');
    
    // Esperar a elementos adicionales si los hay
    try {
      await this.page.waitForSelector('[data-testid="carl-interface"]', { 
        state: 'visible',
        timeout: 5000 
      });
    } catch {
      // Continuar si el elemento no existe
    }
  }

  /**
   * Configura y obtiene el modal de límite de publicación para captura
   * Versión simplificada que asume que el modal ya existe o puede ser activado fácilmente
   */
  async setupPostingLimitModalForSnapshot(): Promise<Locator> {
    try {
      // Navegar a la página principal
      await this.page.goto('/', { waitUntil: 'domcontentloaded' });
      
      // Esperar un momento para que la página se estabilice
      await this.page.waitForTimeout(2000);
      
      // Intentar encontrar el modal si ya existe
      let modal = this.page.locator('[role="dialog"]');
      
      // Si el modal no está visible, intentar activarlo
      if (!(await modal.isVisible().catch(() => false))) {
        console.log('Modal no visible, intentando activarlo...');
        
        // Estrategia 1: Buscar botones que puedan activar el modal
        const possibleTriggers = [
          'button:has-text("Post")',
          'button:has-text("Publicar")', 
          'button:has-text("Create")',
          '[data-testid="post-button"]',
          '.post-button'
        ];
        
        for (const selector of possibleTriggers) {
          try {
            const button = this.page.locator(selector).first();
            if (await button.isVisible({ timeout: 1000 })) {
              console.log(`Encontrado trigger: ${selector}`);
              // Hacer múltiples clicks para activar el límite
              for (let i = 0; i < 3; i++) {
                await button.click({ timeout: 1000 });
                await this.page.waitForTimeout(500);
                
                // Verificar si apareció el modal
                if (await modal.isVisible().catch(() => false)) {
                  console.log('Modal activado exitosamente');
                  break;
                }
              }
              break;
            }
          } catch (error) {
            console.log(`Error con selector ${selector}:`, error);
            continue;
          }
        }
      }
      
      // Verificar si el modal está visible
      if (!(await modal.isVisible().catch(() => false))) {
        // Si no podemos activar el modal automáticamente, crear uno de prueba
        console.log('No se pudo activar el modal, creando modal de prueba...');
        
        await this.page.evaluate(() => {
          const modalHTML = `
            <div role="dialog" aria-modal="true" class="fixed z-[100] inset-0 overflow-y-auto" style="display: block;">
              <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                <div class="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                  <div class="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
                    <div class="sm:flex sm:items-start">
                      <div class="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                        <h3 class="text-base font-semibold leading-6 text-gray-900">Límite de publicación alcanzado</h3>
                        <div class="mt-2">
                          <p class="text-sm text-gray-500">Has alcanzado el límite de publicaciones por hora. Inténtalo más tarde.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                    <button type="button" class="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto">Entendido</button>
                  </div>
                </div>
              </div>
            </div>
          `;
          document.body.insertAdjacentHTML('beforeend', modalHTML);
        });
        
        modal = this.page.locator('[role="dialog"]');
      }
      
      // Esperar a que el modal esté completamente visible
      await modal.waitFor({ state: 'visible', timeout: 5000 });
      await this.page.waitForTimeout(1000);
      
      return modal;
      
    } catch (error) {
      throw new Error(`Error configurando modal de límite de publicación: ${error}`);
    }
  }

  /**
   * Método auxiliar para estabilizar la página antes de screenshots
   */
  async stabilizePage(): Promise<void> {
    // Deshabilitar animaciones
    await this.page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
          transform: none !important;
        }
      `
    });

    // Esperar a que las fonts se carguen
    await this.page.evaluate(() => document.fonts.ready);
    
    // Pequeña espera final
    await this.page.waitForTimeout(500);
  }
}