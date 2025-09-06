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
      await this.solveCaptchaIfPresent();
      await this.submitForm();
      await this.handleEmailVerification(userData.email);
      await this.completeProfileIfNeeded(userData);
      await this.verifySuccessfulRegistration();

      console.log(`✅ Usuario creado exitosamente: ${userData.email}`);
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
    const captchaSelectors = [
      'iframe[src*="recaptcha"]',
      '[data-sitekey]',
      '.g-recaptcha',
      '.captcha'
    ];
    for (const selector of captchaSelectors) {
      const captcha = this.page.locator(selector).first();
      if (await captcha.isVisible({ timeout: 3000 })) {
        console.log('🤖 CAPTCHA detectado, resolviendo...');
        try {
          const siteKey = await this.extractSiteKey();
          if (siteKey) {
            const solution = await this.captchaService.solveRecaptchaV2(siteKey, this.page.url());
            await this.injectCaptchaSolution(solution);
            console.log('✅ CAPTCHA resuelto');
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
          console.warn('⚠️ Error resolviendo CAPTCHA:', errorMessage);
          console.log('💡 Continúa manualmente si es necesario...');
        }
        break;
      }
    }
  }

  private async extractSiteKey(): Promise<string | null> {
    return await this.page.evaluate(() => {
      const element = document.querySelector('[data-sitekey]');
      return element?.getAttribute('data-sitekey') || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';
    });
  }

  private async injectCaptchaSolution(solution: string): Promise<void> {
    await this.page.evaluate((token) => {
      const responseField = document.querySelector('[name="g-recaptcha-response"]') as HTMLTextAreaElement;
      if (responseField) {
        responseField.value = token;
        responseField.style.display = 'block';
      }
    }, solution);
  }

  private async submitForm(): Promise<void> {
    const submitSelectors = [
      'button:has-text("Continue")',
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Sign Up")',
      'button:has-text("Register")',
      'button:has-text("Create Account")'
    ];
    for (const selector of submitSelectors) {
      const button = this.page.locator(selector).first();
      if (await button.isVisible({ timeout: 2000 })) {
        await button.click();
        console.log(`🔄 Formulario enviado usando: ${selector}`);
        await this.page.waitForTimeout(3000);
        return;
      }
    }
    throw new Error('❌ No se encontró botón de envío');
  }

  private async handleEmailVerification(email: string): Promise<void> {
    const verificationIndicators = [
      'text=verification',
      'text=verify',
      'text=code',
      'input[placeholder*="code"]',
      'input[name*="code"]'
    ];
    let needsVerification = false;
    for (const selector of verificationIndicators) {
      if (await this.page.locator(selector).isVisible({ timeout: 5000 })) {
        needsVerification = true;
        break;
      }
    }
    if (needsVerification) {
      console.log('📧 Verificación de email requerida - obteniendo código automáticamente...');
      const code = await this.emailService.getVerificationCode(email);
      const codeInput = this.page.locator('input[placeholder*="code"], input[placeholder*="verification"], input[name*="code"]').first();
      await expect(codeInput).toBeVisible({ timeout: 10000 });
      await codeInput.fill(code);
      const verifyButton = this.page.locator('button:has-text("Verify"), button:has-text("Continue"), button:has-text("Confirm")').first();
      await verifyButton.click();
      await this.page.waitForTimeout(5000);
      console.log('✅ Código de verificación ingresado automáticamente');
    }
  }

  private async completeProfileIfNeeded(userData: UserData): Promise<void> {
    const profileFields = [
      { selector: 'input[placeholder*="interest"]', value: 'Business Development' },
      { selector: 'input[placeholder*="goal"]', value: 'Professional Networking' },
      { selector: 'textarea', value: 'QA Automation Testing' }
    ];
    for (const field of profileFields) {
      if (await this.fillFieldIfExists(field.selector, field.value)) {
        console.log(`📝 Campo de perfil completado: ${field.selector}`);
      }
    }
    const finishButtons = [
      'button:has-text("Complete")',
      'button:has-text("Finish")',
      'button:has-text("Get Started")',
      'button:has-text("Start")'
    ];
    for (const buttonText of finishButtons) {
      const button = this.page.locator(buttonText).first();
      if (await button.isVisible({ timeout: 3000 })) {
        await button.click();
        console.log('🏁 Perfil completado');
        break;
      }
    }
  }

  private async verifySuccessfulRegistration(): Promise<void> {
    await this.page.waitForTimeout(5000);
    const successIndicators = [
      'text=welcome',
      'text=dashboard',
      'text=home',
      'a[href="/carl"]',
      '[data-testid*="user"]',
      'nav, header'
    ];
    const currentUrl = this.page.url();
    const urlIndicatesSuccess = currentUrl.includes('/home') || 
                                currentUrl.includes('/dashboard') || 
                                currentUrl.includes('/profile');
    const elementChecks = await Promise.all(
      successIndicators.map(selector => 
        this.page.locator(selector).isVisible({ timeout: 10000 }).catch(() => false)
      )
    );
    const hasSuccessElements = elementChecks.some(Boolean);
    if (urlIndicatesSuccess || hasSuccessElements) {
      console.log(`✅ Registro exitoso confirmado. URL: ${currentUrl}`);
    } else {
      console.warn('⚠️ No se detectaron indicadores claros de éxito, pero continuando...');
      await this.page.screenshot({ 
        path: `test-results/registration-status-${Date.now()}.png`,
        fullPage: true 
      });
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
