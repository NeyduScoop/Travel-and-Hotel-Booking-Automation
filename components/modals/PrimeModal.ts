import type { Page } from '@playwright/test';

export interface PrimeModalResult {
  appeared: boolean;
  dismissed: boolean;
}

/**
 * PRIME access modal (Project.md §19 / REG-022). The spec states it MAY appear on first landing
 * and block search input. It did not appear on DEVTEST during framework construction
 * (2026-11-14), so detection is defensive: a visible dialog mentioning Prime that is NOT the
 * Prime join email gate. If it appears, it is closed via its close control or Escape.
 */
export class PrimeModal {
  constructor(private readonly page: Page) {}

  private get dialog() {
    return this.page
      .getByRole('dialog')
      .filter({ hasText: /prime/i })
      .filter({ hasNotText: 'Enter your email to continue' })
      .filter({ visible: true })
      .first();
  }

  async isVisible(): Promise<boolean> {
    return this.dialog.isVisible();
  }

  async dismissIfPresent(): Promise<PrimeModalResult> {
    if (!(await this.isVisible())) return { appeared: false, dismissed: false };
    const close = this.dialog.getByRole('button', { name: /close|dismiss|no thanks|not now|✕|×/i }).first();
    if (await close.count()) await close.click();
    else await this.page.keyboard.press('Escape');
    const dismissed = !(await this.isVisible());
    return { appeared: true, dismissed };
  }
}
