import { expect, type Locator, type Page } from '@playwright/test';
import { timeouts } from '../../config/test.config';
import { PrimeModal, type PrimeModalResult } from '../../components/modals/PrimeModal';

/**
 * Base for all Wakanow page objects.
 * The site is Angular SSR; markup is replaced on hydration, so after navigation we wait for the
 * network to settle (bounded) before interacting. Some analytics keep connections open, which is
 * why a settle timeout is tolerated rather than failing the test.
 */
export abstract class BasePage {
  readonly primeModal: PrimeModal;

  constructor(readonly page: Page) {
    this.primeModal = new PrimeModal(page);
  }

  /** Outer <main> landmark. (Results pages nest a second <main> inside it.) */
  get main(): Locator {
    return this.page.locator('main').first();
  }

  get header(): Locator {
    return this.page.getByRole('banner');
  }

  async goto(path: string): Promise<void> {
    await this.page.goto(path, { waitUntil: 'domcontentloaded' });
    await this.settle();
  }

  async settle(timeout: number = timeouts.hydration): Promise<void> {
    await this.page.waitForLoadState('networkidle', { timeout }).catch(() => undefined);
  }

  /** PRIME modal rule (Project.md §19): detect and close before interacting with search. */
  async dismissPrimeModal(): Promise<PrimeModalResult> {
    return this.primeModal.dismissIfPresent();
  }

  async open(path: string): Promise<PrimeModalResult> {
    await this.goto(path);
    return this.dismissPrimeModal();
  }

  /** Application error dialog ("Something went wrong" + message + Close / Try Again), observed 2026-11-15. */
  get errorDialog(): Locator {
    return this.page.getByRole('dialog', { name: 'Something went wrong' });
  }

  /** Text of the visible error dialog, or null. */
  async errorDialogMessage(): Promise<string | null> {
    if (!(await this.errorDialog.isVisible())) return null;
    return (await this.errorDialog.innerText()).replace(/\s+/g, ' ').replace(/^Something went wrong\s*/, '').replace(/\s*Close\s*Try Again\s*$/, '').trim();
  }

  /**
   * Run `action`, and if the application shows its error dialog instead of `success`, press the app's own
   * "Try Again" (Project.md §13 error recovery) up to `retries` times. Every error is returned for evidence.
   */
  async withAppRetry(action: () => Promise<void>, success: Locator, retries = 2, timeout = 120_000): Promise<string[]> {
    const errors: string[] = [];
    await action();
    for (let attempt = 0; ; attempt += 1) {
      // Wait for whichever comes first: the expected next state or the application's error dialog.
      await expect(success.or(this.errorDialog).first()).toBeVisible({ timeout });
      if (await success.first().isVisible()) return errors;
      errors.push((await this.errorDialogMessage()) ?? 'unknown error');
      if (attempt >= retries) throw new Error(`Step failed after ${attempt + 1} attempt(s); application errors: ${errors.join(' | ')}`);
      await this.errorDialog.getByRole('button', { name: 'Try Again' }).click();
      await expect(this.errorDialog).toBeHidden();
    }
  }
}
