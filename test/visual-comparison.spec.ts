import { test, expect } from '@playwright/test';
import { UserCreationHelper } from '../helpers/UserCreationHelper.js';

test('Visual Comparison - Figma vs Platform', async ({ page }) => {
  test.setTimeout(300_000);
  
  console.log('🚀 Iniciando comparación visual...');

  // Paso 1: Crear usuario nuevo
  const userHelper = new UserCreationHelper(page);
  
  try {
    await userHelper.createFreshUser();
    console.log('✅ Usuario creado completamente');
  } catch (error) {
    const currentUrl = page.url();
    if (!currentUrl.includes('login') && !currentUrl.includes('register')) {
      console.log('✅ Usuario creado (error de T&C ignorado)');
    } else {
      throw error;
    }
  }
  
  // Paso 2: Cerrar modales (3 veces como vimos en los logs)
  console.log('🔍 Cerrando modales...');
  await page.waitForTimeout(2000);
  
  for (let i = 0; i < 3; i++) {
    try {
      const xButton = page.locator('button:has-text("X")').first();
      if (await xButton.isVisible({ timeout: 1000 })) {
        await xButton.click();
        console.log(`Modal ${i + 1} cerrado`);
        await page.waitForTimeout(1000);
      }
    } catch {
      break;
    }
  }
  
  // Paso 3: Navegar DIRECTAMENTE sin usar OnlineEventPage
  console.log('📍 Navegando al formulario...');
  await page.goto('/online/post-event?type=free', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  
  // Verificar donde estamos
  const currentUrl = page.url();
  console.log(`URL actual: ${currentUrl}`);
  
  // Paso 4: Cerrar cualquier modal adicional que aparezca
  try {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  } catch {}
  
  // Paso 5: Estabilizar la página
  console.log('🎨 Preparando para captura...');
  await page.addStyleTag({
    content: `
      * { 
        animation: none !important; 
        transition: none !important; 
      }
      .modal, .popup, .notification, .toast {
        display: none !important;
      }
    `
  });
  
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(2000);
  
  // Paso 6: Guardar captura de debug
  await page.screenshot({ 
    path: 'debug-actual.png',
    fullPage: true 
  });
  console.log('📸 Captura guardada: debug-actual.png');
  
  // Paso 7: Comparación visual
  console.log('🎯 Comparando con Figma...');
  
  try {
    await expect(page).toHaveScreenshot('online-event-form.png', {
      fullPage: true,
      maxDiffPixels: 100,
      threshold: 0.2
    });
    console.log('❌ No hay diferencias');
  } catch (error) {
    console.log('\n' + '='.repeat(60));
    console.log('✅ ÉXITO - REPORTE DE DIFERENCIAS GENERADO');
    console.log('='.repeat(60));
    console.log('📁 Ver en test-results/');
    console.log('   • Expected: Tu diseño Figma');
    console.log('   • Actual: La aplicación');
    console.log('   • Diff: Diferencias en ROJO');
    console.log('='.repeat(60) + '\n');
    throw error;
  }
});