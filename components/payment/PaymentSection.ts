import { expect, type Locator, type Page, type Response } from '@playwright/test';
import { parseNaira } from '../../utils/assertions';

/** Payment methods observed on DEVTEST (2026-11-15 to 2026-11-22). Labels and availability differ per product. */
export const PAYMENT_METHODS = {
  payAtBank: 'Pay at Bank',
  bankTransferInstant: 'Bank Transfer Payment (Instant Ticketing)',
  bankTransferAuto: 'Bank Transfer (Auto Ticketing)',
  bookAndPayWithId: 'Book and Pay With ID',
  card: 'Card',
  cardPayment: 'Card payment',
  kalabashWallet: 'Kalabash Wallet',
} as const;

/**
 * Route families, in the owner's priority order (2026-11-22):
 *  1. PAY_AT_BANK, 2. BANK_TRANSFER_INSTANT, 3. BANK_TRANSFER_AUTOMATED (all unpaid/offline settlement);
 *  otherwise 4. CARD (Paystack TEST mode: typed test card when required, else Bank Authentication).
 *  PRIME Flights / PRIME Hotels (owner, updated 2026-11-22): CARD (Paystack TEST) first; KALABASH only when
 *  Paystack fails (see PaystackRouteError). KALABASH is never used for non-PRIME bookings.
 */
export type PaymentRoute = 'PAY_AT_BANK' | 'BANK_TRANSFER_INSTANT' | 'BANK_TRANSFER_AUTOMATED' | 'KALABASH' | 'CARD' | 'NONE';

/** Option label → route family. "Automated bank transfer" covers every observed auto-ticketing label (owner, 2026-11-22). */
export const ROUTE_MATCHERS: { route: Exclude<PaymentRoute, 'NONE'>; label: RegExp }[] = [
  { route: 'PAY_AT_BANK', label: /^pay at bank$/i },
  { route: 'BANK_TRANSFER_INSTANT', label: /^bank transfer payment \(instant ticketing\)$/i },
  // "Bank Transfer (Auto Ticketing)" (Flights, Packages), "Auto Ticketing With Bank Transfer" (Hotels),
  // "Bank Transfer (Autoticketing)" (Tours), "Automated Bank Transfer Payment" (as named in the rule).
  { route: 'BANK_TRANSFER_AUTOMATED', label: /auto\s*-?\s*ticketing|automated bank transfer/i },
  { route: 'CARD', label: /^card( payment)?$/i },
  { route: 'KALABASH', label: /kalabash/i },
];

export function routeOf(option: string): PaymentRoute {
  return ROUTE_MATCHERS.find((m) => m.label.test(option.trim()))?.route ?? 'NONE';
}

/** Thrown when the payment step cannot safely or technically continue; tests convert it to BLOCKED. */
export class PaymentBlockedError extends Error {}

/** Thrown when the application rejects a payment route it offered; tests report it as a FAIL (application defect). */
export class PaymentFailedError extends Error {}

/**
 * PRIME only: the Paystack route failed on the Paystack side (card not usable, bot challenge, not TEST mode,
 * declined or unconfirmed payment). The booking cannot be switched to another route afterwards (Back from
 * Paystack shows an empty cart; "Make Payment Online" opens a separate payment-link site, observed
 * 2026-11-22), so the caller retries with Kalabash on a new booking (`withPaystackFallback`).
 */
export class PaystackRouteError extends Error {}

/**
 * Payment step of the shared checkout (section "Payment" on /cart, revealed after "Proceed to Pay").
 * Observed: radiogroup "Payment method" with no default selection; selecting any option reveals
 * "Make Payment — ₦X"; a "Total amount ₦X" payment card; flights also show "Pay Small Small".
 * After "Make Payment" the cart shows "Generating your booking…" (then "Processing your payment…"
 * for hosted routes) or "Couldn't reserve your booking / Please try again to continue." + "Retry".
 */
export class PaymentSection {
  readonly heading: Locator;
  readonly methods: Locator;
  readonly makePayment: Locator;
  readonly payCardTotal: Locator;
  readonly paySmallSmall: Locator;
  readonly reserveError: Locator;
  readonly retry: Locator;

  constructor(private readonly page: Page, scope: Locator) {
    this.heading = scope.getByRole('heading', { name: 'Payment', level: 2, exact: true });
    this.methods = scope.getByRole('radiogroup', { name: 'Payment method' });
    this.makePayment = scope.getByRole('button', { name: /^Make Payment/ });
    this.payCardTotal = scope.getByText('Total amount', { exact: true }).locator('xpath=following-sibling::strong[1]');
    this.paySmallSmall = scope.getByRole('heading', { name: 'Pay Small Small', level: 3 });
    this.reserveError = scope.getByText("Couldn't reserve your booking", { exact: true });
    this.retry = scope.getByRole('button', { name: 'Retry', exact: true });
  }

  async waitForReady(timeout = 120_000): Promise<void> {
    await expect(this.methods).toBeVisible({ timeout });
  }

  option(name: string): Locator {
    return this.methods.getByRole('radio', { name, exact: true });
  }

  /** Accessible names of the offered methods, read from the radiogroup's ARIA snapshot (the radios carry no aria-label). */
  async available(): Promise<string[]> {
    const snapshot = await this.methods.ariaSnapshot();
    return [...snapshot.matchAll(/- radio "([^"]+)"/g)].map((m) => m[1]);
  }

  async checked(): Promise<string[]> {
    const out: string[] = [];
    for (const name of await this.available()) if (await this.option(name).isChecked()) out.push(name);
    return out;
  }

  async select(name: string): Promise<void> {
    await this.option(name).check();
    await expect(this.option(name)).toBeChecked();
    await expect(this.makePayment).toBeVisible();
  }

  async makePaymentAmount(): Promise<number> {
    return parseNaira(await this.makePayment.innerText());
  }

  async payCardAmount(): Promise<number> {
    return parseNaira(await this.payCardTotal.innerText());
  }

  /**
   * Route by the owner's rule: Pay at Bank → Bank Transfer Payment (Instant Ticketing) → automated bank
   * transfer → Card. PRIME bookings: Card (Paystack) → Kalabash Wallet → bank routes (owner, updated
   * 2026-11-22). `exclude` removes routes, e.g. CARD on the Kalabash fallback attempt. Kalabash is never used
   * for non-PRIME bookings.
   */
  async preferredRoute(opts: { prime?: boolean; exclude?: PaymentRoute[] } = {}): Promise<{ route: PaymentRoute; option?: string; offered: string[] }> {
    const offered = await this.available();
    const pick = (route: PaymentRoute) => offered.find((o) => routeOf(o) === route);
    const order: PaymentRoute[] = opts.prime
      ? ['CARD', 'KALABASH', 'PAY_AT_BANK', 'BANK_TRANSFER_INSTANT', 'BANK_TRANSFER_AUTOMATED']
      : ['PAY_AT_BANK', 'BANK_TRANSFER_INSTANT', 'BANK_TRANSFER_AUTOMATED', 'CARD'];
    for (const route of order.filter((r) => !opts.exclude?.includes(r))) {
      const option = pick(route);
      if (option) return { route, option, offered };
    }
    return { route: 'NONE', offered };
  }

  /**
   * Press "Make Payment" for the selected option. When the app answers "Couldn't reserve your booking"
   * it presses the app's own "Retry" (up to `retries` times) and then raises PaymentFailedError with the
   * failing API responses as evidence.
   */
  async submit(retries = 2): Promise<void> {
    const failures: string[] = [];
    const onResponse = (r: Response) => {
      if (r.status() >= 400 && /\/api\//.test(r.url())) failures.push(`${r.request().method()} ${new URL(r.url()).pathname} → HTTP ${r.status()}`);
    };
    this.page.on('response', onResponse);
    try {
      await this.makePayment.click();
      for (let attempt = 0; ; attempt += 1) {
        const outcome = await Promise.race([
          this.reserveError.waitFor({ timeout: 180_000 }).then(() => 'error' as const),
          this.page.waitForURL((u) => !u.pathname.startsWith('/cart'), { timeout: 180_000 }).then(() => 'left' as const),
        ]).catch(() => 'timeout' as const);
        if (outcome === 'left') return;
        if (outcome === 'timeout') throw new PaymentFailedError(`APPLICATION DEFECT: no outcome 180 s after "Make Payment" (still on the cart). API errors: ${failures.join('; ') || 'none captured'}.`);
        if (attempt >= retries) {
          throw new PaymentFailedError(`APPLICATION DEFECT: "Couldn't reserve your booking" after "Make Payment" and ${retries} app Retry attempt(s). API errors: ${failures.join('; ') || 'none captured'}.`);
        }
        await this.retry.click();
      }
    } finally {
      this.page.off('response', onResponse);
    }
  }
}
