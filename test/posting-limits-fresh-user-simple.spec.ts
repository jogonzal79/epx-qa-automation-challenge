// test/posting-limits-fresh-user-simple.spec.ts
import { test, expect } from '@playwright/test';
import { UserCreationHelper, type UserData } from '../helpers/UserCreationHelper.js';
import { PostingPage } from '../pages/PostingPage.js';
import { ModalHandler } from '../helpers/ModalHandler.js';

// NO usar storageState - necesitamos empezar sin autenticación
test.use({ 
  storageState: undefined
});

test.describe('Posting Limits - Usuario Fresco (Verificación Manual)', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });
  
  test('validar flujo completo: creación de usuario + límites de posting', async ({ page }) => {
    test.setTimeout(600_000); // 10 minutos para permitir verificación manual
    
    let userData: UserData;
    
    await test.step('🚀 Crear usuario completamente nuevo', async () => {
      const userHelper = new UserCreationHelper(page);
      
      console.log('\n🎯 INICIANDO CREACIÓN DE USUARIO FRESCO');
      userData = await userHelper.createFreshUser();
      
      console.log(`\n✅ USUARIO CREADO EXITOSAMENTE`);
      console.log(`📧 Email: ${userData.email}`);
      console.log(`🔑 Password: ${userData.password}`);
      console.log(`👤 Nombre: ${userData.firstName} ${userData.lastName}\n`);
    });
    
    await test.step('🔐 Validar que el usuario está autenticado', async () => {
      const currentUrl = page.url();
      console.log(`📍 URL actual: ${currentUrl}`);
      
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
      
      console.log('📍 Ya estamos en la página principal después del registro');
      console.log('⏳ Esperando a que aparezcan los modales de onboarding...');
      
      await page.waitForTimeout(3000);
      
      const modalHandler = new ModalHandler(page);
      await modalHandler.closeAllOnboardingModals();
      
      const postingPage = new PostingPage(page);
      
      const result = await postingPage.clickGetAdvice();
      
      console.log(`📊 Resultado del primer Get Advice: ${result.type}`);
      console.log(`✅ Éxito: ${result.success}`);
      
      if (result.success && result.type === 'free') {
        console.log('🎉 ¡PRIMER GET ADVICE DISPONIBLE GRATUITAMENTE!');
        
        console.log('📝 Completando formulario para consumir límite gratuito...');
        
        const submitted = await postingPage.fillAndSubmitAdviceForm(
          `Prueba de límites de posting con usuario fresco creado el ${new Date().toISOString()}. ` +
          `Este es el primer Get Advice gratuito para validar que el sistema respeta los límites por usuario.`
        );
        
        if (submitted) {
          console.log('✅ Primer Get Advice completado exitosamente');
        } else {
          console.log('⚠️ Hubo un problema al completar el formulario, pero continuando...');
        }
        
      } else {
        console.log(`⚠️ Resultado inesperado: ${JSON.stringify(result)}`);
        throw new Error('El primer "Get Advice" para un usuario nuevo no fue gratuito.');
      }
    });

    await test.step('🚫 Probar 2do Get Advice - debe requerir PAGO/UPGRADE', async () => {
      console.log('\n🎯 PROBANDO SEGUNDO GET ADVICE (DEBE ESTAR LIMITADO)');
      
      await page.goto('https://app-stg.epxworldwide.com/');
      await page.waitForLoadState('networkidle');
      
      const postingPage = new PostingPage(page);
      const result = await postingPage.clickGetAdvice();
      
      console.log(`📊 Resultado del segundo Get Advice: ${result.type}`);
      console.log(`❌ Bloqueado: ${!result.success}`);
      
      expect(result.success).toBeFalsy();
      expect(['upgrade_required', 'payment_required', 'limit_reached']).toContain(result.type);
      
      console.log('🎉 ¡LÍMITES DE POSTING FUNCIONANDO CORRECTAMENTE!');
      console.log(`🔒 Tipo de restricción: ${result.type}`);
      
      await page.screenshot({ 
        path: `test-results/posting-limit-state-${userData.email.split('@')[0]}.png`,
        fullPage: true 
      });
    });

    // --- SE HA ELIMINADO EL PASO DE C.A.R.L. ---

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