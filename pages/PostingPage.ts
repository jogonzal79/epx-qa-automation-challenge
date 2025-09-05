import type { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage.js';

export interface PostingResult {
  success: boolean;
  type: 'free' | 'upgrade_required' | 'payment_required' | 'limit_reached';
  message?: string;
  cost?: string;
}

export class PostingPage extends BasePage {
  readonly getAdviceButton: Locator;
  readonly accountingFinanceRadio: Locator;
  readonly descriptionEditor: Locator;
  readonly submitButton: Locator;
  readonly wayToGoHeading: Locator;
  readonly continueButton: Locator;
  readonly epxPlusModal: Locator;

  constructor(page: Page) {
    super(page);
    
    this.getAdviceButton = this.page.locator('button:has-text("Get Advice")').first();
    this.accountingFinanceRadio = this.page.getByRole('radio', { name: 'Accounting/Finance' });
    this.descriptionEditor = this.page.getByRole('textbox', { name: 'rdw-editor' });
    this.submitButton = this.page.getByRole('button', { name: 'Submit' });
    this.wayToGoHeading = this.page.getByRole('heading', { name: 'Way to Go!' });
    this.continueButton = this.page.getByRole('button', { name: 'Continue' });
    this.epxPlusModal = this.page.locator('[role="dialog"]').filter({ hasText: 'EPX +' });
  }

  async goto() {
    await this.page.goto('https://app-stg.epxworldwide.com/', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    await this.page.waitForTimeout(3000);
    console.log('Page loaded successfully');
  }

  async clickGetAdvice(): Promise<PostingResult> {
    console.log('Clicking Get Advice button...');
    
    await this.getAdviceButton.waitFor({ state: 'visible', timeout: 10000 });
    await this.getAdviceButton.click();
    
    // Esperar navegación
    await this.page.waitForURL('**/achieve*', { timeout: 10000 });
    console.log('Navigated to achieve page');
    
    // Esperar que desaparezca cualquier loading
    await this.waitForPageToLoad();
    
    return await this.checkPostingState();
  }

  async waitForPageToLoad() {
    console.log('Waiting for page to load completely...');
    
    // Esperar que los spinners/loading desaparezcan
    const loadingSelectors = [
      '.ant-spin-nested-loading',
      '[class*="loading"]',
      '[class*="spinner"]',
      '.loader'
    ];
    
    for (const selector of loadingSelectors) {
      const loading = this.page.locator(selector);
      if (await loading.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log(`Waiting for ${selector} to disappear...`);
        await loading.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {
          console.log(`Loading element ${selector} didn't disappear, continuing anyway`);
        });
      }
    }
    
    // Esperar que aparezca contenido real
    await this.page.waitForTimeout(3000);
  }

  async checkPostingState(): Promise<PostingResult> {
    console.log('Checking posting state...');
    console.log('Current URL:', this.page.url());
    
    // Si la URL indica payment required
    if (this.page.url().includes('pay=advice')) {
      console.log('URL indicates payment/upgrade required');
      
      // Buscar contenido específico que indique el tipo de estado
      const selectors = {
        epxModal: '[role="dialog"]:has-text("EPX")',
        upgradeText: 'text=Upgrade',
        payToPlayText: 'text="Pay to Play"',
        priceText: 'text="$29"',
        membershipText: 'text=membership',
        recordsText: 'text="Our records"'
      };
      
      const results = {};
      for (const [key, selector] of Object.entries(selectors)) {
        results[key] = await this.page.locator(selector).isVisible({ timeout: 5000 }).catch(() => false);
        console.log(`${key}: ${results[key]}`);
      }
      
      // Si encuentra elementos relacionados con upgrade/payment
      if (Object.values(results).some(Boolean)) {
        return { success: false, type: 'upgrade_required' };
      }
      
      return { success: false, type: 'payment_required' };
    }
    
    // Estado libre - formulario normal
    if (await this.accountingFinanceRadio.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Free form state detected');
      return { success: true, type: 'free' };
    }
    
    // Debug info
    await this.page.screenshot({ path: 'test-results/debug-final-state.png', fullPage: true });
    console.log('Page title:', await this.page.title());
    
    return { success: false, type: 'limit_reached' };
  }
}