import type { Page } from '@playwright/test';
import { CaptchaService } from './CaptchaService.js';
import { EmailService } from './EmailService.js';

export interface UserCredentials {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export class UserCreationHelper {
  readonly page: Page;
  private captchaService: CaptchaService;
  private emailService: EmailService;
  
  constructor(page: Page) {
    this.page = page;
    this.captchaService = new CaptchaService();
    this.emailService = new EmailService();
  }
  
  async createFreshUser(): Promise<UserCredentials> {
    console.log('Starting fresh user creation process...');
    
    const userData = this.generateUserData();
    
    try {
      await this.fillRegistrationForm(userData);
      await this.configureInterests();
      await this.selectFreeMembershipWithCaptcha();
      await this.handleEmailVerification();
      await this.completeRegistration();
      
      console.log('User created successfully!');
      return userData;
      
    } catch (error) {
      console.error('User creation failed:', error);
      await this.page.screenshot({ 
        path: `test-results/user-creation-error-${Date.now()}.png`,
        fullPage: true 
      });
      throw error;
    }
  }
  
  private generateUserData(): UserCredentials {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 6);
    
    return {
      email: process.env.TEST_EMAIL || `test_${timestamp}@example.com`,
      password: 'TestPass123!',
      firstName: `Test${randomId}`,
      lastName: `User${timestamp.toString().slice(-4)}`
    };
  }
  
  async fillRegistrationForm(userData: UserCredentials): Promise<void> {
    console.log('Step 1: Filling registration form...');
    
    await this.page.goto('https://app-stg.epxworldwide.com/sign-up', {
      waitUntil: 'domcontentloaded'
    });
    
    await this.page.fill('input[name="firstName"], input[placeholder*="First"]', userData.firstName);
    await this.page.fill('input[name="lastName"], input[placeholder*="Last"]', userData.lastName);
    await this.page.fill('input[name="email"], input[type="email"]', userData.email);
    await this.page.fill('input[name="phone"], input[placeholder*="Phone"]', '+1234567890');
    await this.page.fill('input[name="website"], input[placeholder*="website"]', 'https://example.com');
    await this.page.fill('input[name="linkedin"], input[placeholder*="LinkedIn"]', 'https://linkedin.com/in/testuser');
    await this.page.fill('input[name="password"], input[type="password"]', userData.password);
    
    await this.page.check('input[type="checkbox"]');
    await this.page.click('button[type="submit"], button:has-text("Continue")');
    
    console.log('Registration form submitted');
  }
  
  async configureInterests(): Promise<void> {
    console.log('Step 2: Configuring interests...');
    
    await this.page.waitForSelector('text=Achievement', { timeout: 10000 });
    
    const sliders = await this.page.locator('input[type="range"], .slider').all();
    const values = [33, 25, 18, 24];
    
    for (let i = 0; i < Math.min(sliders.length, values.length); i++) {
      await sliders[i].fill(values[i].toString());
    }
    
    await this.page.click('button:has-text("Continue")');
    console.log('Interests configured');
  }
  
  async selectFreeMembershipWithCaptcha(): Promise<void> {
    console.log('Step 3: Selecting FREE membership and solving captcha...');
    
    await this.page.waitForSelector('text=FREE MEMBER', { timeout: 10000 });
    await this.page.click('button:has-text("Complete as a FREE member")');
    
    await this.page.waitForSelector('[data-sitekey], .g-recaptcha', { timeout: 10000 });
    
    const siteKey = await this.page.getAttribute('[data-sitekey]', 'data-sitekey');
    if (!siteKey) {
      throw new Error('Could not find reCAPTCHA site key');
    }
    
    const captchaSolution = await this.captchaService.solveRecaptchaV2(siteKey, this.page.url());
    
    await this.page.evaluate((token) => {
      const textarea = document.getElementById('g-recaptcha-response') as HTMLTextAreaElement;
      if (textarea) {
        textarea.value = token;
        textarea.style.display = 'block';
      }
      
      if ((window as any).grecaptcha) {
        (window as any).grecaptcha.getResponse = () => token;
      }
    }, captchaSolution);
    
    await this.page.click('button:has-text("Continue")');
    console.log('Captcha solved and membership selected');
  }
  
  async handleEmailVerification(): Promise<void> {
    console.log('Step 4: Handling email verification...');
    
    await this.page.waitForSelector('text=Enter the 4-digit code', { timeout: 10000 });
    await this.emailService.waitForManualVerificationCode();
  }
  
  async completeRegistration(): Promise<void> {
    console.log('Step 5: Completing registration...');
    
    await this.page.click('button:has-text("Let\'s go!")');
    
    await this.page.waitForURL('**/home', { timeout: 15000 }).catch(() => {
      return this.page.waitForSelector('nav, header, [data-testid*="user"]', { timeout: 15000 });
    });
    
    console.log('Registration completed successfully');
  }
}