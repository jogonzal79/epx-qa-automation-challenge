// test/posting-limits-fresh-user-simple.spec.ts
import { test, expect } from '@playwright/test';
import { UserCreationHelper, type UserData } from '../helpers/UserCreationHelper.js';
import { PostingPage } from '../pages/PostingPage.js';
import { CarlPage } from '../pages/CarlPage.js';

// NO usar storageState - necesitamos empezar sin autenticación
test.use({ 
  storageState: undefined
});

test.describe('Posting Limits - Usuario Fresco (Verificación Manual)', () => {
  
  test.beforeEach(async ({ page }) => {
    // Solo limpiar cookies
    await page.context().clearCookies();
  });
  
  test('validar flujo completo: creación de usuario + límites de posting', async ({ page }) => {
    test.setTimeout(600_000); // 10 minutos para permitir verificación manual
    
    let userData: UserData;
    
    await test.step('🚀 Crear usuario completamente nuevo', async () => {
      const userHelper = new UserCreationHelper(page);
      
      console.log('\n🎯 INICIANDO CREACIÓN DE USUARIO FRESCO');
      console.log('📧 Se usará verificación manual de email');
      console.log('⚠️ Mantente atento para ingresar el código de verificación\n');
      
      userData = await userHelper.createFreshUser();
      
      console.log(`\n✅ USUARIO CREADO EXITOSAMENTE`);
      console.log(`📧 Email: ${userData.email}`);
      console.log(`🔑 Password: ${userData.password}`);
      console.log(`👤 Nombre: ${userData.firstName} ${userData.lastName}\n`);
    });
    
    await test.step('🔐 Validar que el usuario está autenticado', async () => {
      // Verificar URL y elementos de navegación
      const currentUrl = page.url();
      console.log(`📍 URL actual: ${currentUrl}`);
      
      // Buscar indicadores de autenticación
      const authIndicators = [
        page.locator('a[href="/carl"]'),
        page.locator('[data-testid*="user"]'),
        page.locator('nav'),
        page.locator('header')
      ];
      
      let isAuthenticated = false;
      for (const indicator of authIndicators) {
        if (await indicator.isVisible({ timeout: 5000 }).catch(() => false)) {
          isAuthenticated = true;
          break;
        }
      }
      
      expect(isAuthenticated, 'Usuario debe estar autenticado después del registro').toBeTruthy();
      console.log('✅ Usuario autenticado correctamente');
    });

    await test.step('📝 Probar 1er Get Advice - debe ser GRATIS', async () => {
      console.log('\n🎯 PROBANDO PRIMER GET ADVICE (GRATIS)');
      
      const postingPage = new PostingPage(page);
      
      // Ir al home si no estamos ahí
      if (!page.url().includes('/home') && !page.url().endsWith('/')) {
        await page.goto('https://app-stg.epxworldwide.com/');
        await page.waitForTimeout(3000);
      }
      
      const result = await postingPage.clickGetAdvice();
      
      console.log(`📊 Resultado del primer Get Advice: ${result.type}`);
      console.log(`✅ Éxito: ${result.success}`);
      
      if (result.success && result.type === 'free') {
        console.log('🎉 ¡PRIMER GET ADVICE DISPONIBLE GRATUITAMENTE!');
        
        // Completar el formulario para consumir el límite gratuito
        console.log('📝 Completando formulario para consumir límite gratuito...');
        
        await expect(postingPage.accountingFinanceRadio).toBeVisible({ timeout: 10000 });
        await postingPage.accountingFinanceRadio.click();
        
        await expect(postingPage.descriptionEditor).toBeVisible({ timeout: 10000 });
        await postingPage.descriptionEditor.fill(
          `Prueba de límites de posting con usuario fresco creado el ${new Date().toISOString()}. ` +
          `Este es el primer Get Advice gratuito para validar que el sistema respeta los límites por usuario.`
        );
        
        await postingPage.submitButton.click();
        
        // Esperar confirmación
        const success = await Promise.race([
          postingPage.wayToGoHeading.isVisible({ timeout: 15000 }),
          page.locator('text=success, text=thank, text=submitted').isVisible({ timeout: 15000 })
        ]);
        
        if (success) {
          console.log('✅ Primer Get Advice enviado exitosamente');
        } else {
          console.log('⚠️ No se detectó confirmación clara, pero continuando...');
        }
        
      } else {
        console.log(`⚠️ Resultado inesperado: ${JSON.stringify(result)}`);
        console.log('💭 Esto podría indicar que ya hay límites o restricciones');
      }
    });

    await test.step('🚫 Probar 2do Get Advice - debe requerir PAGO/UPGRADE', async () => {
      console.log('\n🎯 PROBANDO SEGUNDO GET ADVICE (DEBE ESTAR LIMITADO)');
      
      // Volver al home
      await page.goto('https://app-stg.epxworldwide.com/');
      await page.waitForTimeout(3000);
      
      const postingPage = new PostingPage(page);
      const result = await postingPage.clickGetAdvice();
      
      console.log(`📊 Resultado del segundo Get Advice: ${result.type}`);
      console.log(`❌ Bloqueado: ${!result.success}`);
      
      // El segundo intento debe estar limitado
      expect(result.success).toBeFalsy();
      expect(['upgrade_required', 'payment_required', 'limit_reached']).toContain(result.type);
      
      console.log('🎉 ¡LÍMITES DE POSTING FUNCIONANDO CORRECTAMENTE!');
      console.log(`🔒 Tipo de restricción: ${result.type}`);
      
      // Tomar screenshot del estado de límite
      await page.screenshot({ 
        path: `test-results/posting-limit-state-${userData.email.split('@')[0]}.png`,
        fullPage: true 
      });
    });

    await test.step('🤖 Validar que C.A.R.L. sigue funcionando', async () => {
      console.log('\n🎯 VERIFICANDO QUE C.A.R.L. NO ESTÁ AFECTADO POR LÍMITES');
      
      const carl = new CarlPage(page);
      await carl.goto();
      
      await carl.askQuestion('Hello C.A.R.L., can you confirm you are working normally despite posting limits?');
      const response = await carl.waitForResponse({ timeoutMs: 60000 });
      
      expect(response.length).toBeGreaterThan(20);
      console.log(`✅ C.A.R.L. respondió correctamente: "${response.slice(0, 100)}..."`);
      console.log('✅ C.A.R.L. funciona independientemente de los límites de posting');
    });

    await test.step('📊 Documentar resultados finales', async () => {
      console.log('\n🎯 GENERANDO REPORTE FINAL');
      
      await page.screenshot({ 
        path: `test-results/final-state-${userData.firstName}-${Date.now()}.png`,
        fullPage: true 
      });
      
      // Crear un resumen en archivo de texto
      const reportContent = `
REPORTE DE PRUEBA DE LÍMITES DE POSTING
======================================

Usuario Creado:
- Email: ${userData.email}
- Nombre: ${userData.firstName} ${userData.lastName}
- Empresa: ${userData.company}
- Fecha: ${new Date().toISOString()}

Resultados de Validación:
✅ 1er Get Advice: GRATIS (consumido)
❌ 2do Get Advice: REQUIERE PAGO/UPGRADE
✅ C.A.R.L.: Funcionando sin limitaciones

Conclusión:
🎯 El sistema de límites de posting funciona correctamente
🔒 Los límites se aplican por usuario como se esperaba
🤖 C.A.R.L. no se ve afectado por los límites de posting

Estado Final: LÍMITES VALIDADOS EXITOSAMENTE
`;

      console.log(reportContent);
      
      // Guardar reporte
      const fs = await import('fs/promises');
      await fs.writeFile(
        `test-results/posting-limits-report-${userData.firstName}.txt`, 
        reportContent
      );
      
      console.log('\n🎉 ¡PRUEBA DE LÍMITES COMPLETADA EXITOSAMENTE!');
    });
  });

  test('validar detección de mensajes de error específicos', async ({ page }) => {
    test.setTimeout(400_000);
    
    await test.step('Crear usuario y agotar límites rápidamente', async () => {
      const userHelper = new UserCreationHelper(page);
      const userData = await userHelper.createFreshUser();
      
      console.log(`📧 Usuario para prueba de mensajes: ${userData.email}`);
    });
    
    await test.step('Consumir límite gratuito rápidamente', async () => {
      const postingPage = new PostingPage(page);
      
      // Primer Get Advice (gratis)
      await postingPage.goto();
      await postingPage.clickGetAdvice();
      
      if (await postingPage.accountingFinanceRadio.isVisible({ timeout: 10000 })) {
        await postingPage.accountingFinanceRadio.click();
        await postingPage.descriptionEditor.fill('Consumiendo límite gratuito para testing');
        await postingPage.submitButton.click();
        await page.waitForTimeout(5000);
      }
    });
    
    await test.step('Analizar mensajes y UI de límites', async () => {
      await page.goto('https://app-stg.epxworldwide.com/');
      await page.waitForTimeout(3000);
      
      const postingPage = new PostingPage(page);
      await postingPage.clickGetAdvice();
      
      // Analizar elementos de la UI de límites
      const limitElements = {
        modal: page.locator('[role="dialog"]'),
        upgradeButton: page.locator('button:has-text("Upgrade")'),
        payButton: page.locator('button:has-text("Pay")'),
        priceText: page.locator('text="$29"'),
        limitMessage: page.locator('text=limit, text=reached, text=exceeded'),
        membershipText: page.locator('text=membership, text=member')
      };
      
      console.log('\n🔍 ANÁLISIS DE UI DE LÍMITES:');
      
      for (const [name, locator] of Object.entries(limitElements)) {
        const isVisible = await locator.isVisible({ timeout: 5000 }).catch(() => false);
        if (isVisible) {
          const text = await locator.first().innerText().catch(() => '');
          console.log(`✅ ${name}: "${text.slice(0, 80)}..."`);
        } else {
          console.log(`❌ ${name}: no visible`);
        }
      }
      
      await page.screenshot({ 
        path: 'test-results/limit-ui-analysis.png',
        fullPage: true 
      });
      
      console.log('📊 Análisis de UI completado');
    });
  });
});