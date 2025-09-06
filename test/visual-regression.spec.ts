// test/visual-regression.spec.ts
// Estrategia para demostrar comparación visual sin acceso a Figma
import { test, expect } from '@playwright/test';

test.use({ 
  storageState: 'storageState.json' 
});

test.describe('Regresión Visual - Simulando Comparación Figma vs Plataforma', () => {

  // ✅ Test 1: Captura baseline de elementos clave de la UI
  test('baseline - capturar elementos UI principales', async ({ page }) => {
    await page.goto('/');
    
    // Estabilizar página
    await page.waitForLoadState('networkidle');
    await page.addStyleTag({
      content: `*, *::before, *::after { 
        animation-duration: 0s !important; 
        transition-duration: 0s !important; 
      }`
    });
    
    // Capturar diferentes componentes que estarían en Figma
    
    // 1. Header/Navigation
    const header = page.locator('header, nav, [role="navigation"]').first();
    if (await header.isVisible()) {
      await expect(header).toHaveScreenshot('component-header.png');
    }
    
    // 2. Sidebar/Menu principal  
    const sidebar = page.locator('[class*="sidebar"], [class*="menu"], aside').first();
    if (await sidebar.isVisible()) {
      await expect(sidebar).toHaveScreenshot('component-sidebar.png');
    }
    
    // 3. Cards/Feed elements
    const feedCard = page.locator('[class*="card"], [class*="post"], article').first();
    if (await feedCard.isVisible()) {
      await expect(feedCard).toHaveScreenshot('component-card.png');
    }
  });

  // ✅ Test 2: C.A.R.L. Interface - comparación visual
  test('CARL interface - regresión visual', async ({ page }) => {
    await page.goto('/carl');
    
    await page.waitForSelector('textarea[placeholder="How can C.A.R.L. help you today?"]');
    await page.waitForTimeout(2000);
    
    // Deshabilitar animaciones
    await page.addStyleTag({
      content: `*, *::before, *::after { 
        animation-duration: 0s !important; 
        transition-duration: 0s !important; 
      }`
    });
    
    // Screenshot del chat interface completo
    await expect(page).toHaveScreenshot('carl-interface-full.png', {
      fullPage: true,
      maxDiffPixels: 1000
    });
    
    // Screenshot solo del área de chat
    const chatArea = page.locator('textarea, [class*="chat"], [class*="conversation"]').first();
    if (await chatArea.isVisible()) {
      await expect(chatArea).toHaveScreenshot('carl-chat-area.png');
    }
  });

  // ✅ Test 3: Modal/Dialog comparisons 
  test('modales y dialogs - regresión visual', async ({ page }) => {
    await page.goto('/');
    
    // Activar modal (el que sea que aparezca)
    const triggerButton = page.locator('button:has-text("Post"), button[class*="post"]').first();
    if (await triggerButton.isVisible()) {
      await triggerButton.click();
      
      const modal = page.locator('[role="dialog"], .modal, [class*="modal"]').first();
      await modal.waitFor({ state: 'visible', timeout: 5000 });
      
      // Estabilizar modal
      await page.addStyleTag({
        content: `*, *::before, *::after { 
          animation-duration: 0s !important; 
          transition-duration: 0s !important; 
        }`
      });
      
      await page.waitForTimeout(500);
      
      await expect(modal).toHaveScreenshot('modal-design.png', {
        maxDiffPixels: 800
      });
    }
  });

  // ✅ Test 4: Responsive design validation
  test('responsive - diferentes viewports', async ({ page }) => {
    const viewports = [
      { width: 1920, height: 1080, name: 'desktop' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      await page.addStyleTag({
        content: `*, *::before, *::after { 
          animation-duration: 0s !important; 
          transition-duration: 0s !important; 
        }`
      });
      
      await expect(page).toHaveScreenshot(`layout-${viewport.name}.png`, {
        fullPage: true,
        maxDiffPixels: 1500
      });
    }
  });

  // ✅ Test 5: Forms visual validation
  test('formularios - regresión visual', async ({ page }) => {
    // Navegar a formulario de Get Advice
    await page.goto('/');
    
    // Buscar y navegar a formularios
    const adviceLink = page.locator('text=Get Advice, a[href*="advice"]').first();
    if (await adviceLink.isVisible()) {
      await adviceLink.click();
      await page.waitForLoadState('networkidle');
      
      // Screenshot del formulario
      const form = page.locator('form, [class*="form"]').first();
      if (await form.isVisible()) {
        await expect(form).toHaveScreenshot('form-get-advice.png');
      }
    }
  });

  // ✅ Test 6: Error states y mensajes
  test('estados de error - validación visual', async ({ page }) => {
    await page.goto('/');
    
    // Intentar activar estados de error (ej: enviar formulario vacío)
    const form = page.locator('form').first();
    if (await form.isVisible()) {
      const submitBtn = form.locator('button[type="submit"], input[type="submit"]').first();
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        
        // Esperar mensajes de error
        await page.waitForTimeout(1000);
        
        // Screenshot de estado de error
        await expect(form).toHaveScreenshot('form-error-state.png');
      }
    }
  });

});