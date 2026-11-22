import { readBoolEnv, readEnv, secretValues } from '../utils/environment.utils';
import type { EnvironmentName, EnvironmentConfig } from '../types/common.types';

/**
 * Approved Wakanow environments (source: Wakanow Project.md §2).
 * DEVTEST is the default when no environment is supplied.
 */
export const ENVIRONMENTS: Record<EnvironmentName, EnvironmentConfig> = {
  DEVTEST: {
    name: 'DEVTEST',
    baseUrl: 'https://wkn-web-v4-devtest.azurewebsites.net',
    allowsCartCreation: true,
  },
  PREPROD: {
    name: 'PREPROD',
    baseUrl: 'https://wkn-web-v4-production-preprod.azurewebsites.net',
    allowsCartCreation: true,
  },
  PRODUCTION: {
    name: 'PRODUCTION',
    baseUrl: 'https://www.wakanow.com/en-ng',
    // Never create carts/bookings against production from automation.
    allowsCartCreation: false,
  },
};

export function resolveEnvironment(): EnvironmentConfig {
  const requested = (readEnv('TEST_ENV') ?? 'DEVTEST').toUpperCase();
  if (!(requested in ENVIRONMENTS)) {
    throw new Error(
      `Unknown TEST_ENV "${requested}". Allowed: ${Object.keys(ENVIRONMENTS).join(', ')}. ` +
        'Run is BLOCKED until a valid environment is supplied.',
    );
  }
  const env = ENVIRONMENTS[requested as EnvironmentName];
  const override = readEnv('BASE_URL');
  if (override) {
    const approved = Object.values(ENVIRONMENTS).some((e) => override.startsWith(e.baseUrl));
    if (!approved) {
      throw new Error(`BASE_URL "${override}" is not an approved Wakanow environment URL.`);
    }
    return { ...env, baseUrl: override.replace(/\/$/, '') };
  }
  return env;
}

export const environment = resolveEnvironment();

/** PRIME credentials are only ever read from the environment; values are never logged. */
export interface Credentials {
  email: string;
  password: string;
}

export function primeCredentials(): Credentials | undefined {
  const email = readEnv('PRIME_EMAIL');
  const password = readEnv('PRIME_PASSWORD');
  return email && password ? { email, password } : undefined;
}

export function affiliateCredentials(): Credentials | undefined {
  const email = readEnv('AFFILIATE_EMAIL');
  const password = readEnv('AFFILIATE_PASSWORD');
  return email && password ? { email, password } : undefined;
}

/**
 * Booking / payment safety switches (both default to false).
 * - bookingSubmission: allows "Proceed to Pay" (creates a booking record) and "Pay at Bank" (unpaid booking).
 * - paymentAuthentication: allows the card / bank-authentication route on a test-mode gateway.
 * Neither is ever honoured on PRODUCTION.
 */
export const safety = {
  bookingSubmission: environment.name !== 'PRODUCTION' && readBoolEnv('ALLOW_TEST_BOOKING_SUBMISSION', false),
  paymentAuthentication: environment.name !== 'PRODUCTION' && readBoolEnv('ALLOW_TEST_PAYMENT_AUTHENTICATION', false),
} as const;

export interface TestCard {
  number: string;
  expiry: string;
  cvv: string;
  pin?: string;
  otp?: string;
}

/** Test-mode card for the card route; values are never logged. */
export function testCard(): TestCard | undefined {
  const number = readEnv('TEST_CARD_NUMBER');
  const expiry = readEnv('TEST_CARD_EXPIRY');
  const cvv = readEnv('TEST_CARD_CVV');
  return number && expiry && cvv ? { number, expiry, cvv, pin: readEnv('TEST_CARD_PIN'), otp: readEnv('TEST_CARD_OTP') } : undefined;
}

/** Every secret value currently configured, used to scrub reports and attachments. */
export function configuredSecrets(): string[] {
  return secretValues();
}

export interface KalabashCredentials {
  /** National number as typed after the fixed +234 prefix (10 digits). */
  phone: string;
  password: string;
  pin?: string;
}

/** Kalabash wallet test credentials (KALABASH_* or the owner's PhoneNumber / password / pin). */
export function kalabashCredentials(): KalabashCredentials | undefined {
  const rawPhone = readEnv('KALABASH_PHONE') ?? readEnv('PhoneNumber');
  const password = readEnv('KALABASH_PASSWORD') ?? readEnv('password');
  if (!rawPhone || !password) return undefined;
  // The checkout shows a fixed "+234" prefix and expects the 10-digit national number.
  const digits = rawPhone.replace(/\D/g, '').replace(/^234/, '').replace(/^0/, '');
  return { phone: digits, password, pin: readEnv('KALABASH_PIN') ?? readEnv('pin') };
}
