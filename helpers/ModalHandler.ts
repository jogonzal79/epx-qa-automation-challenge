// helpers/ModalHandler.ts
import type { Page } from '@playwright/test';

export class ModalHandler {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async closeAllOnboardingModals(): Promise<void> {
    console.log('🔍 Verificando y cerrando modales de onboarding...');
    
    try {
      // IMPORTANTE: Esperar a que los modales aparezcan antes de cerrarlos
      console.log('⏳ Esperando a que aparezcan los modales...');
      await this.page.waitForTimeout(3000); // Dar tiempo para que aparezcan
      
      // Estrategia 1: Cerrar modales por IDs dinámicos de headlessui
      await this.closeHeadlessUIModals();
      
      // Esperar entre modales
      await this.page.waitForTimeout(1000);
      
      // Estrategia 2: Manejar el modal "AI for Networking" con "Let's go"
      await this.handleAINetworkingModal();
      
      // Esperar entre modales
      await this.page.waitForTimeout(1000);
      
      // Estrategia 3: Manejar el tutorial (Next → Close)
      await this.handleTutorialModal();
      
      console.log('✅ Todos los modales cerrados exitosamente');
      
      // Esperar a que la interfaz se estabilice
      await this.page.waitForTimeout(2000);
      
    } catch (error) {
      console.log('⚠️ Algunos modales podrían no haber aparecido, continuando...');
    }
  }

  private async closeHeadlessUIModals(): Promise<void> {
    // Buscar todos los modales de headlessui con botones de cierre X
    const modalSelectors = [
      '#headlessui-dialog-18 svg',  // Modal específico 1
      '#headlessui-dialog-16 svg',  // Modal específico 2
      '[id^="headlessui-dialog"] svg',  // Cualquier modal headlessui con SVG
      '[id^="headlessui-dialog"] button[aria-label="Close"]',
      '[id^="headlessui-dialog"] button:has(svg)',
      '[role="dialog"] button:has(svg)',
      'button[aria-label="Close"]'
    ];

    // Intentar cerrar hasta 2 modales con X
    let modalsClosed = 0;
    for (const selector of modalSelectors) {
      if (modalsClosed >= 2) break; // Ya cerramos los 2 modales esperados
      
      try {
        const closeButton = this.page.locator(selector).first();
        
        if (await closeButton.isVisible({ timeout: 3000 })) {
          console.log(`📍 Cerrando modal ${modalsClosed + 1} con selector: ${selector}`);
          await closeButton.click();
          modalsClosed++;
          await this.page.waitForTimeout(1500); // Esperar entre modales
        }
      } catch (error) {
        // Continuar con el siguiente selector
      }
    }
    
    if (modalsClosed > 0) {
      console.log(`✅ ${modalsClosed} modal(es) cerrado(s) con X`);
    }
  }
  
  private async handleAINetworkingModal(): Promise<void> {
    try {
      // Buscar el modal de "AI for Networking" con el botón "Let's go"
      const letsGoButton = this.page.locator('button:has-text("Let\'s go")').first();
      
      if (await letsGoButton.isVisible({ timeout: 5000 })) {
        console.log('📍 Detectado modal "AI for Networking"');
        await letsGoButton.click();
        console.log('✅ Clic en "Let\'s go"');
        await this.page.waitForTimeout(2000); // Esperar más tiempo para que se cierre
        
        // Verificar si se cerró correctamente
        const modalStillVisible = await this.page.locator('text="AI for Networking"').isVisible({ timeout: 1000 })
          .catch(() => false);
        
        if (modalStillVisible) {
          console.log('⚠️ Modal aún visible, intentando cerrar con X');
          // Intentar cerrar con X si sigue visible
          const closeButton = this.page.locator('[role="dialog"] button:has(svg)').first();
          if (await closeButton.isVisible({ timeout: 1000 })) {
            await closeButton.click();
          }
        }
      }
    } catch (error) {
      console.log('ℹ️ Modal "AI for Networking" no encontrado');
    }
  }

  private async handleTutorialModal(): Promise<void> {
    try {
      // Buscar botón "Next"
      const nextButton = this.page.getByRole('button', { name: 'Next' });
      
      if (await nextButton.isVisible({ timeout: 3000 })) {
        console.log('📍 Detectado modal de tutorial');
        await nextButton.click();
        console.log('✅ Clic en "Next"');
        
        await this.page.waitForTimeout(1000);
        
        // Buscar y hacer clic en Close
        const closeButton = this.page.getByRole('button', { name: 'Close' });
        await closeButton.waitFor({ state: 'visible', timeout: 5000 });
        await closeButton.click();
        console.log('✅ Clic en "Close"');
        
        await this.page.waitForTimeout(1000);
      }
    } catch (error) {
      console.log('ℹ️ Modal de tutorial no encontrado');
    }
  }

  // Método para verificar si hay modales visibles
  async hasVisibleModals(): Promise<boolean> {
    const modalSelectors = [
      '[role="dialog"]',
      '[aria-modal="true"]',
      '.modal',
      '.popup',
      '[id*="headlessui-dialog"]'
    ];

    for (const selector of modalSelectors) {
      if (await this.page.locator(selector).isVisible({ timeout: 1000 }).catch(() => false)) {
        return true;
      }
    }

    return false;
  }
}