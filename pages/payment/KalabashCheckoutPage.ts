import { expect, type Locator, type Page } from '@playwright/test';
import type { KalabashCredentials } from '../../config/environment.config';

/**
 * Kalabash Wallet hosted checkout (DEVTEST: kb-wallet-checkout.azurewebsites.net/invoice/<id>).
 * Reached from the cart: "Kalabash Wallet" → "Make Payment" → "Generating your booking…" →
 * "Processing your payment…" → redirect after about 25 s (observed 2026-11-22).
 *
 * Sign-in screen: heading "Sign in to Kalabash"; phone textbox after a fixed "+234" prefix
 * (placeholder is a digit mask, no label); "Enter your password"; "Sign in" enabled once both are filled.
 * Credentials come only from the environment (kalabashCredentials()) and are never logged.
 */
export class KalabashCheckoutPage {
  static readonly host = /kb-wallet-checkout|kalabash/i;

  constructor(readonly page: Page) {}

  get main(): Locator {
    return this.page.getByRole('main');
  }
  get signInHeading(): Locator {
    return this.main.getByRole('heading', { name: 'Sign in to Kalabash' });
  }
  get phone(): Locator {
    // The phone field has no accessible label; it is the first textbox on the sign-in form.
    return this.main.getByRole('textbox').first();
  }
  get password(): Locator {
    return this.main.getByRole('textbox', { name: 'Enter your password' });
  }
  get signInButton(): Locator {
    return this.main.getByRole('button', { name: 'Sign in', exact: true });
  }

  /** Invoice screen after sign-in: "Pay <merchant> before your session ends", "Amount due", "Available balance", "Pay ₦X". */
  get payButton(): Locator {
    return this.main.getByRole('button', { name: /^Pay ₦[\d,]+(\.\d{2})?$/ });
  }
  get cancelButton(): Locator {
    return this.main.getByRole('button', { name: 'Cancel', exact: true });
  }

  /**
   * The invoice renders in stages: first "Pay before your session ends." and a disabled "Pay ₦0.00",
   * then the merchant, amount due and balance (observed 2026-11-22). Wait for the loaded state.
   */
  async waitForInvoice(timeout = 60_000): Promise<void> {
    await expect(this.payButton).toBeEnabled({ timeout });
    await expect
      .poll(async () => /Pay \S.* before your session ends/i.test((await this.main.innerText()).replace(/\s+/g, ' ')) && (await this.amountDue().catch(() => 0)) > 0, { timeout })
      .toBe(true);
  }

  /** Merchant named on the invoice ("Pay Test Merchant before your session ends."). */
  async merchant(): Promise<string> {
    const text = (await this.main.innerText()).replace(/\s+/g, ' ');
    const m = /Pay (.+?) before your session ends/i.exec(text);
    if (!m) throw new Error('Kalabash checkout: merchant line not found');
    return m[1].trim();
  }

  private async nairaAfter(label: string): Promise<number> {
    const text = (await this.main.innerText()).replace(/\s+/g, ' ');
    // Labels may be CSS upper-cased ("AMOUNT DUE"), so match case-insensitively.
    const m = new RegExp(`${label}\\s*₦\\s*([\\d,]+(?:\\.\\d{2})?)`, 'i').exec(text);
    if (!m) throw new Error(`Kalabash checkout: no "${label}" amount`);
    return Math.round(Number(m[1].replace(/,/g, '')));
  }
  async amountDue(): Promise<number> {
    return this.nairaAfter('Amount due');
  }
  async availableBalance(): Promise<number> {
    return this.nairaAfter('Available balance');
  }

  /** "Authorize Payment" step after "Pay ₦X": one textbox per PIN digit, then "Pay ₦X" (observed 2026-11-22). */
  get authorizeHeading(): Locator {
    return this.main.getByRole('heading', { name: 'Authorize Payment' });
  }
  get pinBoxes(): Locator {
    return this.main.getByRole('textbox');
  }

  /** Result screen: "Payment successful", "₦X paid to <merchant>", Invoice, Transaction ref, "Back to <merchant>". */
  get successHeading(): Locator {
    return this.main.getByRole('heading', { name: 'Payment successful' });
  }

  /**
   * Press "Pay ₦X" on the invoice and enter the wallet PIN. Entering the last digit submits the payment
   * by itself (observed 2026-11-22); a still-enabled "Pay ₦X" is pressed as a fallback.
   */
  async payWithPin(pin: string): Promise<void> {
    await this.payButton.click();
    await expect(this.authorizeHeading).toBeVisible({ timeout: 30_000 });
    const boxes = await this.pinBoxes.count();
    if (boxes !== pin.length) throw new Error(`Kalabash asks for a ${boxes}-digit PIN but the configured PIN has a different length.`);
    for (let i = 0; i < boxes; i += 1) await this.pinBoxes.nth(i).fill(pin[i]);
    await expect(this.successHeading.or(this.payButton)).toBeVisible({ timeout: 30_000 });
    if (!(await this.successHeading.isVisible()) && (await this.payButton.isEnabled())) await this.payButton.click();
    await expect(this.successHeading).toBeVisible({ timeout: 60_000 });
  }

  /** Value of a term on the success screen ("Paid to", "Invoice", "Transaction ref", "Date & time"). */
  async receiptField(term: string): Promise<string> {
    const value = this.main.getByRole('term').filter({ hasText: term }).locator('xpath=following-sibling::*[1]');
    return (await value.innerText()).trim();
  }

  /**
   * Hand back to the merchant: the success screen opens the merchant in a new tab; "Back to <merchant>"
   * is the fallback. Returns the page that shows the merchant (Wakanow).
   */
  async returnToMerchant(merchantHost: RegExp, timeout = 60_000): Promise<Page> {
    const context = this.page.context();
    const onMerchant = (p: Page) => merchantHost.test(new URL(p.url()).host);
    const existing = context.pages().find((p) => p !== this.page && onMerchant(p));
    if (existing) return existing;
    const popup = context.waitForEvent('page', { timeout: 15_000 }).catch(() => undefined);
    let target = await popup;
    if (!target) {
      const back = this.main.getByRole('button', { name: /^Back to / });
      const opened = context.waitForEvent('page', { timeout: 15_000 }).catch(() => undefined);
      await back.click();
      target = (await opened) ?? this.page;
    }
    await target.waitForURL((u) => merchantHost.test(u.host), { timeout });
    return target;
  }

  /** Wait for the hosted checkout after "Make Payment" (the cart shows two loading phases first). */
  async waitForCheckout(timeout = 180_000): Promise<void> {
    await this.page.waitForURL((u) => KalabashCheckoutPage.host.test(u.host), { timeout });
    await expect(this.signInHeading.or(this.main.getByRole('heading').first())).toBeVisible({ timeout: 60_000 });
  }

  async signIn(creds: KalabashCredentials): Promise<void> {
    await expect(this.signInHeading).toBeVisible();
    await this.phone.fill(creds.phone);
    await this.password.fill(creds.password);
    await expect(this.signInButton).toBeEnabled();
    await this.signInButton.click();
    await expect(this.signInHeading).toBeHidden({ timeout: 60_000 });
  }
}
