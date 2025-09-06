import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { CaptchaService } from './CaptchaService.js';
import { GuerrillaEmailService } from './GuerrillaEmailService.js';

export interface UserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  company: string;
  position: string;
  website: string;
  linkedin: string;
}

export class UserCreationHelper {
  private page: Page;
  private captchaService: CaptchaService;
  private emailService: GuerrillaEmailService;

  constructor(page: Page) {
    this.page = page;
    this.captchaService = new CaptchaService();
    this.emailService = new GuerrillaEmailService();
  }

  async createFreshUser(): Promise<UserData> {
    const userData = this.generateUserData();
    userData.email = await this.emailService.generateTemporaryEmail();

    console.log(`\n🚀 Iniciando creación de usuario: ${userData.email}`);

    try {
      await this.navigateToSignUp();
      await this.fillSignUpForm(userData);
      await this.submitForm();
      await this.handleInterestsScreen();
      await this.handleMembershipScreen();
      await this.handleEmailVerification(userData.email);
      await this.verifySuccessfulRegistration();

      console.log(`✅ ¡REGISTRO DE USUARIO COMPLETADO EXITOSAMENTE!`);
      return userData;

    } catch (error) {
      await this.page.screenshot({
        path: `test-results/user-creation-error-${Date.now()}.png`,
        fullPage: true
      });

      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      throw new Error(`❌ Error creando usuario: ${errorMessage}`);
    }
  }
  
  private async handleMembershipScreen(): Promise<void> {
    console.log('🕵️‍♂️ Verificando si aparece la pantalla de membresía...');
    
    const freeMemberOption = this.page.getByText('FREE MEMBEREnjoy full access');

    try {
        await freeMemberOption.waitFor({ state: 'visible', timeout: 15000 });
        console.log('📝 Detectada pantalla de membresía. Seleccionando opción gratuita...');
        
        await freeMemberOption.click();
        
        // La lógica para el CAPTCHA en esta pantalla se manejará si es necesario
        
        console.log('✅ Membresía seleccionada. Haciendo clic en "Continue"...');
        const continueButton = this.page.getByRole('button', { name: 'Continue' });
        await expect(continueButton).toBeEnabled({ timeout: 10000 });
        await continueButton.click();

        await freeMemberOption.waitFor({ state: 'hidden', timeout: 10000 });
        console.log('✅ Pantalla de membresía completada.');

    } catch (error) {
      console.log('ℹ️ No se detectó la pantalla de membresía, continuando el flujo.');
    }
  }

  private async handleInterestsScreen(): Promise<void> {
    console.log('🕵️‍♂️ Verificando si aparece la pantalla de intereses...');
    
    const interestsHeading = this.page.getByText('What matters to you most right now?').first();

    try {
      await interestsHeading.waitFor({ state: 'visible', timeout: 15000 });
      console.log('📝 Detectada pantalla de intereses. Ajustando slider...');

      const achievementSlider = this.page.locator('#achievement');
      await achievementSlider.waitFor({ state: 'visible', timeout: 5000 });

      const box = await achievementSlider.boundingBox();
      if (box) {
        await this.page.mouse.click(box.x + box.width - 5, box.y + box.height / 2);
        console.log(`- Slider 'Achievement' ajustado al 100%.`);
        await this.page.waitForTimeout(500);
      } else {
        throw new Error('No se pudo obtener la posición del slider #achievement.');
      }
      
      console.log('✅ Slider ajustado. Haciendo clic en "Continue"...');
      const continueButton = this.page.getByRole('button', { name: 'Continue' });
      
      await expect(continueButton).toBeEnabled({ timeout: 5000 });
      await continueButton.click();
      
      await interestsHeading.waitFor({ state: 'hidden', timeout: 10000 });
      console.log('✅ Pantalla de intereses completada.');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      if (await interestsHeading.isVisible()) {
        throw new Error(`No se pudo completar el paso de la pantalla de intereses: ${errorMessage}`);
      } else {
        console.log('ℹ️ No se detectó la pantalla de intereses, continuando el flujo.');
      }
    }
  }

  private generateUserData(): UserData {
    const timestamp = Date.now().toString().slice(-6);
    const randomSuffix = Math.random().toString(36).substring(2, 6);

    return {
      email: '',
      password: 'Cmendoza1.',
      firstName: `Test${randomSuffix}`,
      lastName: `User${timestamp}`,
      company: `TestCompany${timestamp}`,
      position: 'QA Automation Engineer',
      website: 'https://github.com/qa-automation',
      linkedin: 'https://www.linkedin.com/in/qa-automation/'
    };
  }

  private async navigateToSignUp(): Promise<void> {
    try {
      await this.page.goto('https://app-stg.epxworldwide.com/sign-up', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      await this.page.waitForTimeout(5000);
    } catch (error) {
      console.error('❌ Error navegando a página de registro:', error);
      await this.page.screenshot({
        path: `test-results/signup-page-error-${Date.now()}.png`,
        fullPage: true
      });
      throw new Error('❌ No se pudo encontrar página de registro válida');
    }
  }

  private async fillSignUpForm(userData: UserData): Promise<void> {
    console.log('📝 Llenando formulario de registro...');

    await this.fillFieldIfExists('input[placeholder="example@email.com"]', userData.email);
    await this.fillFieldIfExists('input[type="password"]', userData.password);

    const confirmFields = [
      'input[placeholder*="confirm"]',
      'input[placeholder*="repeat"]',
      'input[name*="confirm"]',
      'input[name*="password2"]'
    ];
    for (const selector of confirmFields) {
      if (await this.fillFieldIfExists(selector, userData.password)) {
        break;
      }
    }

    await this.fillFieldIfExists('input[placeholder="First Name"]', userData.firstName);
    await this.fillFieldIfExists('input[placeholder="Last Name"]', userData.lastName);
    await this.fillFieldIfExists('input[placeholder="Company"]', userData.company);

    await this.fillPhoneNumber('+1 (646) 322-9821');
    await this.fillFieldIfExists('#urlCompany', userData.website);
    await this.fillFieldIfExists('#linkedln', userData.linkedin);

    await this.checkTermsAndConditions();
    console.log('✅ Formulario de registro completado');
  }

  private async fillFieldIfExists(selector: string, value: string): Promise<boolean> {
    const field = this.page.locator(selector).first();
    if (await field.isVisible({ timeout: 2000 })) {
      try {
        await field.click();
        await field.fill('');
        await field.type(value, { delay: 50 });
        await field.press('Tab');
        return true;
      } catch (e) {
        console.warn(`⚠️ Error llenando campo (${selector}):`, e);
      }
    }
    return false;
  }

  private async fillPhoneNumber(value: string): Promise<boolean> {
    const possibleSelectors = [
      'input[placeholder*="phone"]',
      'input[type="tel"]',
      'input[placeholder*="+"]',
      'input[placeholder*="123"]',
      'input[name*="phone"]',
      'input[placeholder="+1 123 123"]'
    ];

    for (const selector of possibleSelectors) {
      const phoneInput = this.page.locator(selector).first();
      try {
        if (await phoneInput.isVisible({ timeout: 3000 })) {
          console.log(`📱 Intentando llenar teléfono con selector: ${selector}`);
          await phoneInput.click({ force: true });
          await phoneInput.press('Meta+A').catch(() => {});
          await phoneInput.press('Control+A').catch(() => {});
          await phoneInput.press('Backspace').catch(() => {});
          await phoneInput.fill('');
          await phoneInput.type(value, { delay: 80 });
          await phoneInput.press('Tab');
          console.log('✅ Teléfono llenado correctamente');
          return true;
        }
      } catch (e) {
        console.warn(`⚠️ Falló intento con ${selector}:`, e);
      }
    }

    console.warn('❌ Ningún selector de teléfono fue válido o visible.');
    return false;
  }

  private async checkTermsAndConditions(): Promise<void> {
    try {
      const label = this.page.locator('label[for="terms_conditions"]').nth(1);
      await label.waitFor({ timeout: 3000 });
      await label.click();
      console.log('✅ Casilla de términos y condiciones marcada.');
    } catch (error) {
      throw new Error(`❌ Error marcando términos y condiciones: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async solveCaptchaIfPresent(): Promise<void> {
    // La lógica de resolución de CAPTCHA se maneja externamente
  }

  private async submitForm(): Promise<void> {
    const submitButton = this.page.locator('button[type="submit"]').first();
    await submitButton.waitFor({ state: 'visible', timeout: 5000 });
    await submitButton.click();
    console.log(`🔄 Formulario (Paso 1) enviado.`);
  }

  // =================================================================
  // FUNCIÓN DE VERIFICACIÓN FINAL CON ESPERA EXPLÍCITA Y ROBUSTA
  // =================================================================
private async handleEmailVerification(email: string): Promise<void> {
    const codeInput = this.page.locator('#code');
    
    try {
        await codeInput.waitFor({ state: 'visible', timeout: 15000 });
        console.log('📧 Detectada pantalla de verificación de email. Obteniendo código...');
        
        const code = await this.emailService.getVerificationCode(email);
        await codeInput.fill(code);
        
        console.log('✅ Código escrito. Buscando botón de verificación...');
        
        // Esperar un momento para que el DOM se actualice
        await this.page.waitForTimeout(1000);
        
        // Intentar múltiples selectores para el botón
        const buttonSelectors = [
            'button:has-text("Let\'s go!")',
            'button:has-text("Let\'s go")',
            'button[type="submit"]',
            'button:text-is("Let\'s go!")',
            '//button[contains(., "Let")]',
            'button >> text=/Let.*go/i',
            'button:visible'
        ];
        
        let verifyButton = null;
        
        // Intentar encontrar el botón con diferentes selectores
        for (const selector of buttonSelectors) {
            try {
                const btn = this.page.locator(selector).first();
                const isVisible = await btn.isVisible({ timeout: 1000 }).catch(() => false);
                
                if (isVisible) {
                    const buttonText = await btn.textContent().catch(() => '');
                    console.log(`✅ Botón encontrado: "${buttonText}" con selector: ${selector}`);
                    verifyButton = btn;
                    break;
                }
            } catch (e) {
                continue;
            }
        }
        
        if (!verifyButton) {
            // Buscar cualquier botón visible como último recurso
            const allButtons = await this.page.locator('button:visible').all();
            console.log(`📋 Total de botones visibles encontrados: ${allButtons.length}`);
            
            for (const button of allButtons) {
                const text = await button.textContent().catch(() => '');
                console.log(`  - Botón: "${text?.trim()}"`);
                
                if (text && (
                    text.toLowerCase().includes('go') ||
                    text.toLowerCase().includes('verify') ||
                    text.toLowerCase().includes('submit') ||
                    text.toLowerCase().includes('continue')
                )) {
                    verifyButton = button;
                    console.log(`✅ Seleccionando botón: "${text.trim()}"`);
                    break;
                }
            }
        }
        
        if (!verifyButton) {
            await this.page.screenshot({
                path: `test-results/no-verify-button-${Date.now()}.png`,
                fullPage: true
            });
            throw new Error('No se pudo encontrar el botón de verificación');
        }
        
        // Intentar hacer clic
        console.log('🖱️ Intentando hacer clic en el botón...');
        
        try {
            // Scroll al botón si es necesario
            await verifyButton.scrollIntoViewIfNeeded().catch(() => {});
            
            // Intentar clic normal
            await verifyButton.click({ timeout: 5000 });
            console.log('✅ Clic realizado con éxito');
        } catch (clickError) {
            console.log('⚠️ Clic normal falló, intentando con force...');
            
            try {
                await verifyButton.click({ force: true });
                console.log('✅ Clic forzado realizado');
            } catch (forceClickError) {
                console.log('⚠️ Clic forzado falló, intentando con JavaScript...');
                await verifyButton.evaluate((el: HTMLElement) => el.click());
                console.log('✅ Clic con JavaScript realizado');
            }
        }
        
        // Esperar a que algo cambie después del clic
        console.log('⏳ Esperando respuesta después del clic...');
        
        try {
            await Promise.race([
                // Esperar que el input desaparezca
                codeInput.waitFor({ state: 'hidden', timeout: 10000 }),
                
                // O que aparezca algún elemento del dashboard
                this.page.locator('nav, header, [data-testid*="dashboard"], [data-testid*="user"]')
                    .first()
                    .waitFor({ state: 'visible', timeout: 10000 }),
                
                // O que la URL cambie
                this.page.waitForFunction(() => {
                    const currentUrl = window.location.href;
                    return !currentUrl.includes('verify') && !currentUrl.includes('code');
                }, { timeout: 10000 })
            ]);
            
            console.log('✅ Navegación detectada después de la verificación');
        } catch (e) {
            console.log('⚠️ No se detectó cambio claro, pero continuando...');
            
            // Como último recurso, intentar Enter
            try {
                await codeInput.press('Enter');
                await this.page.waitForTimeout(2000);
                console.log('✅ Enter presionado como alternativa');
            } catch {}
        }
        
        console.log('✅ Proceso de verificación de email completado');
        
    } catch(e) {
        // Información de debugging
        console.log('❌ Error en verificación. Información de debugging:');
        
        const currentUrl = this.page.url();
        console.log(`  - URL actual: ${currentUrl}`);
        
        const visibleInputs = await this.page.locator('input:visible').count();
        const visibleButtons = await this.page.locator('button:visible').count();
        console.log(`  - Inputs visibles: ${visibleInputs}`);
        console.log(`  - Botones visibles: ${visibleButtons}`);
        
        // Screenshot para debugging
        await this.page.screenshot({
            path: `test-results/email-verification-error-${Date.now()}.png`,
            fullPage: true
        });
        
        const errorMessage = e instanceof Error ? e.message : 'Error desconocido';
        throw new Error(`Falló el manejo de la verificación de email: ${errorMessage}`);
    }
}
  // =================================================================

  private async verifySuccessfulRegistration(): Promise<void> {
    console.log('🕵️‍♂️ Verificando registro exitoso y redirección al dashboard...');
    const successIndicators = [
      'a[href="/carl"]',
      '[data-testid*="user"]',
      'nav', 
      'header'
    ];

    const successPromise = Promise.any(
      successIndicators.map(selector => 
        this.page.locator(selector).first().waitFor({ state: 'visible', timeout: 30000 })
      )
    );

    try {
      await successPromise;
      await this.page.waitForLoadState('networkidle', { timeout: 5000 });
      const currentUrl = this.page.url();
      console.log(`✅ ¡Bienvenido! Registro exitoso confirmado. URL final: ${currentUrl}`);
    } catch (error) {
        await this.page.screenshot({
            path: `test-results/registration-final-status-error-${Date.now()}.png`,
            fullPage: true
        });
        throw new Error('❌ Falló la verificación final del registro. No se encontraron indicadores de dashboard después de la verificación de email.');
    }
  }

  async cleanup(): Promise<void> {
    try {
      await this.emailService.cleanup();
      console.log('🧹 Limpieza completada');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.warn('⚠️ Error en limpieza:', errorMessage);
    }
  }
}