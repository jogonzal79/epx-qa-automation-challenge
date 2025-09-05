import type { Page } from '@playwright/test';
import { PostingPage } from '../pages/PostingPage.js';

export class PostingLimitsHelper {
  readonly page: Page;
  readonly postingPage: PostingPage;
  
  constructor(page: Page) {
    this.page = page;
    this.postingPage = new PostingPage(page);
  }

  async testBasicFlow() {
    await this.postingPage.goto();
    
    console.log('Testing posting limits detection...');
    const result = await this.postingPage.clickGetAdvice();
    console.log('Posting state detected:', result.type);
    
    return { result };
  }
}