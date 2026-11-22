import { test as moduleTest } from './module.fixture';
import { affiliateCredentials, primeCredentials, safety, type Credentials } from '../config/environment.config';
import { LoginPage } from '../pages/common/LoginPage';
import { applySession, cachedSession } from './auth.session';

/**
 * Single entry point for specs: `import { test, expect, Tag } from '../../../fixtures/test.fixture'`.
 * Adds safety gates and authenticated sessions on top of the module page objects.
 */
export const test = moduleTest.extend<{
  /** Skips as BLOCKED when the environment forbids creating carts (e.g. PRODUCTION). */
  requireCartCreation: void;
  /**
   * Required by any test that presses "Proceed to Pay" (creates a booking) or submits Pay at Bank.
   * BLOCKED unless ALLOW_TEST_BOOKING_SUBMISSION=true on a non-production environment.
   */
  requireBookingSubmission: void;
  /** Required by the card / bank-authentication route. BLOCKED unless ALLOW_TEST_PAYMENT_AUTHENTICATION=true. */
  requirePaymentAuthentication: void;
  /** PRIME credentials from env, or BLOCKED when absent (Project.md §4). */
  primeAccount: Credentials;
  /** Affiliate credentials from env, or BLOCKED when absent. */
  affiliateAccount: Credentials;
  /** Signs the test's own browser context in as the PRIME member before the test body runs. */
  signedInPrime: void;
  /** Signs the test's own browser context in as the affiliate before the test body runs. */
  signedInAffiliate: void;
}>({
  requireCartCreation: async ({ env, blocked }, use) => {
    if (!env.allowsCartCreation) blocked(`Cart/booking creation is not permitted on ${env.name}.`);
    await use();
  },
  requireBookingSubmission: async ({ env, blocked }, use) => {
    if (!env.allowsCartCreation) blocked(`Booking submission is never permitted on ${env.name}.`);
    if (!safety.bookingSubmission) blocked('PAYMENT AUTHORISATION REQUIRED: set ALLOW_TEST_BOOKING_SUBMISSION=true to let tests create (unpaid) test bookings.');
    await use();
  },
  requirePaymentAuthentication: async ({ env, blocked }, use) => {
    if (!env.allowsCartCreation) blocked(`Payment authentication is never permitted on ${env.name}.`);
    if (!safety.paymentAuthentication) blocked('PAYMENT AUTHORISATION REQUIRED: set ALLOW_TEST_PAYMENT_AUTHENTICATION=true (test-mode gateway and test card only).');
    await use();
  },
  primeAccount: async ({ blocked }, use) => {
    const creds = primeCredentials();
    if (!creds) blocked('MISSING CREDENTIALS: PRIME_EMAIL / PRIME_PASSWORD are unavailable in the configured test environment.');
    await use(creds!);
  },
  affiliateAccount: async ({ blocked }, use) => {
    const creds = affiliateCredentials();
    if (!creds) blocked('MISSING CREDENTIALS: AFFILIATE_EMAIL / AFFILIATE_PASSWORD are unavailable in the configured test environment.');
    await use(creds!);
  },
  signedInPrime: async ({ browser, context, page, primeAccount }, use) => {
    await applySession(context, await cachedSession('prime', primeAccount, browser));
    await new LoginPage(page).goto('/');
    await use();
  },
  signedInAffiliate: async ({ browser, context, page, affiliateAccount }, use) => {
    await applySession(context, await cachedSession('affiliate', affiliateAccount, browser));
    await new LoginPage(page).goto('/');
    await use();
  },
});

export { expect } from '@playwright/test';

/**
 * For specs that sign in: Playwright traces record request bodies and failure snapshots can record
 * input values, so these artifacts are disabled; the summary reporter also scrubs secrets from text
 * artifacts after every run.
 */
export const credentialSafeArtifacts = { trace: 'off', video: 'off', screenshot: 'off' } as const;

export const Tag = {
  smoke: '@smoke',
  regression: '@regression',
  e2e: '@e2e',
  flights: '@flights',
  hotels: '@hotels',
  packages: '@packages',
  tours: '@tours',
  visa: '@visa',
  prime: '@prime',
  primeFlights: '@prime-flights',
  primeHotels: '@prime-hotels',
  affiliate: '@affiliate',
  addons: '@travel-addons',
  payment: '@payment',
  confirmation: '@confirmation',
  positive: '@positive',
  negative: '@negative',
  boundary: '@boundary',
  critical: '@critical',
} as const;
