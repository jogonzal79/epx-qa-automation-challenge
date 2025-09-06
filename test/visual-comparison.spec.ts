// test/visual-comparison.spec.ts
import { test, expect } from '@playwright/test';
import { VisualTestHelper } from '../helpers/VisualTestHelper.js';

// Usar el estado de autenticación guardado
test.use({ 
  storageState: 'storageState.json' 
});

test.describe('Pruebas de Regresión Visual con Helper', () => {

  // Test 1: Captura de la página de C.A.R.L.
  test('debe mantener la consistencia visual de la página de C.A.R.L.', async ({ page }) => {
    const visualHelper = new VisualTestHelper(page);

    // 1. Preparar la página usando el Helper
    await visualHelper.setupCarlPageForSnapshot();

    // 2. Realizar la comparación de la captura de pantalla
    await expect(page).toHaveScreenshot('carl-page.png', {
      fullPage: true,
      maxDiffPixels: 100
    });
  });

  // Test 2: Captura del modal de límite
  test('debe mantener la consistencia visual del modal de límite de publicación', async ({ page }) => {
    const visualHelper = new VisualTestHelper(page);
    
    // 1. Usar el Helper para disparar y obtener el modal
    const modal = await visualHelper.setupPostingLimitModalForSnapshot();

    // 2. Realizar la comparación, capturando solo el locator devuelto por el Helper
    await expect(modal).toHaveScreenshot('posting-limit-modal.png');
  });

});