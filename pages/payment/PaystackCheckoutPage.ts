import { expect, type Locator, type Page } from '@playwright/test';
import type { TestCard } from '../../config/environment.config';
import { PaymentBlockedError } from '../../components/payment/PaymentSection';

/**
 * Paystack hosted checkout (checkout.paystack.com/<access code>), reached from the cart's "Card" /
 * "Card payment" option. Observed 2026-11-22 (TEST mode):
 *  - header "Pay NGN X" + "Test"; list "Pay with": Card, Transfer, Bank, USSD, PayAttitude;
 *  - TEST mode offers ready-made test outcomes: "Success", "Bank Authentication", "Declined";
 *    "Pay NGN X" is disabled until one is chosen; "Use another card" shows the card form;
 *  - card form: textboxes "Card Number", "Card Expiry", "CVV"; "Use a test card" returns to the test outcomes;
 *  - Bank Authentication: "Please click the button below to authenticate with your bank" + "Authenticate";
 *  - success: heading "Payment Successful" ("You paid NGN X to WAKANOW"), then redirect to Wakanow
 *    /confirmation/<bookingId> → /summary/<bookingId>.
 *
 * Bot protection is never bypassed: a verification challenge is reported as BLOCKED (ENVIRONMENT ISSUE).
 */
export class PaystackCheckoutPage {
  static readonly host = /checkout\.paystack\.com/;

  constructor(readonly page: Page) {}

  get testBadge(): Locator {
    return this.page.getByText(/^Pay NGN [\d,.]+ Test$/).or(this.page.getByText('Test', { exact: true })).first();
  }
  get testOutcomeHint(): Locator {
    return this.page.getByText('Use any of the options below to test the payment flow');
  }
  testOutcome(name: 'Success' | 'Bank Authentication' | 'Declined'): Locator {
    return this.page.getByText(name, { exact: true });
  }
  get payButton(): Locator {
    return this.page.getByRole('button', { name: /^Pay NGN [\d,]+(\.\d{2})?$/ });
  }
  get authenticateButton(): Locator {
    return this.page.getByRole('button', { name: 'Authenticate', exact: true });
  }
  get successHeading(): Locator {
    return this.page.getByRole('heading', { name: 'Payment Successful' });
  }
  get cardNumber(): Locator {
    return this.page.getByRole('textbox', { name: 'Card Number' });
  }
  get cardExpiry(): Locator {
    return this.page.getByRole('textbox', { name: 'Card Expiry' });
  }
  get cardCvv(): Locator {
    return this.page.getByRole('textbox', { name: 'CVV' });
  }
  get challenge(): Locator {
    return this.page.getByText(/Performing security verification|verify you are human|not a bot/i).first();
  }

  async waitForCheckout(timeout = 120_000): Promise<void> {
    await this.page.waitForURL((u) => PaystackCheckoutPage.host.test(u.host), { timeout });
    await expect(this.payButton.or(this.challenge)).toBeVisible({ timeout: 60_000 });
    if (await this.challenge.isVisible()) {
      throw new PaymentBlockedError('ENVIRONMENT ISSUE: Paystack checkout shows a bot-verification challenge to the test browser. It is not bypassed; allow-list the test runners or disable the challenge for test mode.');
    }
  }

  /** TEST mode only: refuse to continue on a live checkout. */
  async assertTestMode(): Promise<void> {
    // The badge is CSS upper-cased on some checkouts ("TEST", observed 2026-11-22) and the test-outcome list
    // renders a moment after the Pay button, so wait briefly for either signal before deciding.
    await expect(this.testOutcomeHint.or(this.page.getByText(/^test$/i))).toBeVisible({ timeout: 30_000 }).catch(() => undefined);
    const text = (await this.page.locator('body').innerText()).replace(/\s+/g, ' ');
    const testMode = /\bTEST\b/i.test(text.replace(/to test the payment flow/i, '')) || (await this.offersTestOutcomes());
    if (!testMode) throw new PaymentBlockedError('Paystack checkout is not in TEST mode; the card route is only allowed against a test-mode gateway.');
  }

  /** True when the checkout offers ready-made test outcomes, i.e. no card details are required. */
  async offersTestOutcomes(): Promise<boolean> {
    return this.testOutcomeHint.isVisible();
  }

  /** Owner's rule when no card input is required: Bank Authentication → Pay → Authenticate. */
  async payWithBankAuthentication(): Promise<void> {
    await this.testOutcome('Bank Authentication').click();
    await expect(this.payButton).toBeEnabled();
    await this.payButton.click();
    await expect(this.authenticateButton).toBeVisible({ timeout: 60_000 });
    await this.authenticateButton.click();
  }

  /** Card details from .env (TEST_CARD_*), only when the checkout requires card input. */
  async payWithCard(card: TestCard): Promise<void> {
    await this.cardNumber.fill(card.number);
    await this.cardExpiry.fill(card.expiry);
    await this.cardCvv.fill(card.cvv);
    await expect(this.payButton).toBeEnabled();
    await this.payButton.click();
  }

  /** Wait for "Payment Successful" and the redirect back to the Wakanow booking summary. */
  /** Returns 'success' when Paystack showed "Payment Successful" before redirecting, 'left' when it redirected without it. */
  async waitForSuccessAndReturn(timeout = 120_000): Promise<'success' | 'left'> {
    const leftPaystack = () => this.page.waitForURL((u) => !PaystackCheckoutPage.host.test(u.host), { timeout });
    const outcome = await Promise.race([
      this.successHeading.waitFor({ timeout }).then(() => 'success' as const),
      leftPaystack().then(() => 'left' as const),
    ]).catch(() => 'stuck' as const);
    if (outcome === 'stuck') {
      throw new PaymentBlockedError('Paystack did not confirm the payment: it asked for a further step that has not been observed (e.g. card PIN/OTP), which is not automated without observed selectors.');
    }
    if (outcome === 'success') await leftPaystack();
    return outcome;
  }
}
