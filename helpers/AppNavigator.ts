import type { Page } from '@playwright/test';

export class AppNavigator {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goToLoginPage() {
    await this.page.goto('https://app-stg.epxworldwide.com/log-in');
    await this.page.waitForSelector('input[type="email"]');
  }

  async goToCarlPage() {
    await this.page.goto('https://app-stg.epxworldwide.com/carl');
    await this.page.waitForURL(/.*\/carl/);
  }

  async goToAdviceForm() {
    await this.page.goto('https://app-stg.epxworldwide.com/achieve/seek-advice');
    await this.page.waitForSelector('form'); // Ajusta selector real
  }

  async goToOnlineEventsForm() {
    await this.page.goto('https://app-stg.epxworldwide.com/online');
    await this.page.waitForSelector('form'); // Ajusta selector real
  }
}
