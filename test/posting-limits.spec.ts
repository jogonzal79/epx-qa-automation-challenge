// test/posting-limits.spec.ts
import { test, expect } from '@playwright/test';
import { PostingLimitsHelper } from '../helpers/PostingLimitsHelper.js';

test.use({ 
  storageState: 'storageState.json' 
});

test.describe('Posting Limits - Estado Final', () => {
  test('validar detección de estado de límites', async ({ page }) => {
    test.setTimeout(120_000);
    
    const helper = new PostingLimitsHelper(page);
    
    // 🔧 MEJORA 1: Retry logic para manejar inconsistencias
    let result: any = null;
    let attempts = 0;
    const maxAttempts = 2;
    
    while (attempts < maxAttempts) {
      attempts++;
      console.log(`\n🔄 Intento ${attempts}/${maxAttempts}`);
      
      try {
        const { result: testResult } = await helper.testBasicFlow();
        result = testResult;
        
        // Si obtenemos un resultado válido (no error), salir del loop
        if (result.type !== 'error') {
          console.log(`✅ Estado válido detectado en intento ${attempts}: ${result.type}`);
          break;
        }
        
        // Si es error y no es el último intento, retry
        if (result.type === 'error' && attempts < maxAttempts) {
          console.log(`⚠️ Error detectado, reintentando en 3 segundos...`);
          await page.waitForTimeout(3000);
          
          // Reset: volver a la página principal
          await page.goto('https://app-stg.epxworldwide.com/', { 
            waitUntil: 'networkidle',
            timeout: 30000 
          });
          await page.waitForTimeout(2000);
        }
      } catch (error) {
        console.log(`❌ Error en intento ${attempts}:`, error);
        if (attempts === maxAttempts) {
          throw error;
        }
        await page.waitForTimeout(3000);
      }
    }
    
    // 🔧 Validación de que tenemos un resultado
    if (!result) {
      throw new Error('No se pudo obtener ningún resultado después de todos los intentos');
    }
    
    console.log('Estado final detectado:', result);
    
    // 🔧 MEJORA 2: Validación más flexible pero robusta
    const validLimitStates = ['upgrade_required', 'payment_required', 'limit_reached'];
    const isValidLimitState = validLimitStates.includes(result.type);
    
    // 🔧 MEJORA 3: Mensaje de error más descriptivo
    if (!isValidLimitState) {
      console.log(`❌ Estado inesperado: ${result.type}`);
      console.log(`   Mensaje: ${result.message}`);
      console.log(`   Expected: uno de ${validLimitStates.join(', ')}`);
      
      // Información adicional para debugging
      const currentUrl = page.url();
      console.log(`   URL actual: ${currentUrl}`);
      
      // Screenshot adicional para análisis
      await page.screenshot({
        path: `test-results/posting-limits-debug-${Date.now()}.png`,
        fullPage: true
      });
    }
    
    // 🔧 MEJORA 4: Assertion con mensaje más claro
    expect(isValidLimitState, 
      `Esperaba estado de límite válido (${validLimitStates.join(', ')}) pero recibí: ${result.type}. ` +
      `Mensaje: ${result.message || 'N/A'}`
    ).toBeTruthy();
    
    // 🔧 MEJORA 5: Validaciones específicas por tipo
    if (result.type === 'upgrade_required') {
      console.log('✅ Sistema requiere upgrade - implementación de límites funcional');
      expect(result.success).toBeFalsy();
    } else if (result.type === 'payment_required') {
      console.log('✅ Sistema requiere pago - implementación de límites funcional');
      expect(result.success).toBeFalsy();
    } else if (result.type === 'limit_reached') {
      console.log('✅ Sistema indica límite alcanzado - implementación de límites funcional');
      expect(result.success).toBeFalsy();
    }
    
    // El punto importante es que NO esté en estado 'free'
    expect(result.type).not.toBe('free');
    
    console.log('🎯 Validación de límites completada exitosamente');
  });
  
  // 🔧 MEJORA 6: Test adicional para debugging cuando hay problemas
  test('debug - analizar estado actual detallado', async ({ page }) => {
    test.setTimeout(60_000);
    
    console.log('\n🔍 === ANÁLISIS DETALLADO DE ESTADO ===');
    
    await page.goto('https://app-stg.epxworldwide.com/', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    const currentUrl = page.url();
    console.log(`📍 URL inicial: ${currentUrl}`);
    
    // Verificar presencia del botón Get Advice
    const getAdviceButton = page.getByRole('button', { name: 'Get Advice' });
    const buttonVisible = await getAdviceButton.isVisible({ timeout: 10000 });
    console.log(`🔘 Botón Get Advice visible: ${buttonVisible}`);
    
    if (buttonVisible) {
      console.log('🖱️ Haciendo clic en Get Advice...');
      await getAdviceButton.click();
      
      // Esperar más tiempo para que la navegación se complete
      await page.waitForTimeout(5000);
      
      const finalUrl = page.url();
      console.log(`📍 URL después del clic: ${finalUrl}`);
      
      // Analizar diferentes elementos en la página
      const elementChecks = [
        { name: 'Modal de diálogo', selector: '[role="dialog"]' },
        { name: 'Texto $29', selector: 'text="$29"' },
        { name: 'Botón Upgrade', selector: 'button:has-text("Upgrade")' },
        { name: 'Texto upgrade membership', selector: 'text=/upgrade.*membership/i' },
        { name: 'Formulario de advice', selector: 'form' },
        { name: 'Radio Accounting/Finance', selector: 'input[type="radio"]' },
        { name: 'Campo descripción', selector: '[role="textbox"]' },
        { name: 'Texto limit reached', selector: 'text=/limit.*reached/i' }
      ];
      
      console.log('\n📋 Elementos encontrados en la página:');
      for (const check of elementChecks) {
        const element = page.locator(check.selector);
        const isVisible = await element.isVisible({ timeout: 2000 }).catch(() => false);
        
        if (isVisible) {
          const text = await element.first().innerText().catch(() => '');
          console.log(`✅ ${check.name}: "${text.slice(0, 60)}..."`);
        } else {
          console.log(`❌ ${check.name}: no encontrado`);
        }
      }
      
      // Screenshot para análisis manual
      await page.screenshot({
        path: `test-results/state-analysis-${Date.now()}.png`,
        fullPage: true
      });
      
      console.log('📸 Screenshot guardado para análisis manual');
    }
  });
});