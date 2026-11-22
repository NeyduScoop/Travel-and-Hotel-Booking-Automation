import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env'), quiet: true });

/** Read an optional environment variable, trimming whitespace. Empty strings are treated as unset. */
export function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function readBoolEnv(name: string, fallback: boolean): boolean {
  const value = readEnv(name);
  if (value === undefined) return fallback;
  return /^(1|true|yes|on)$/i.test(value);
}

export function readIntEnv(name: string, fallback: number): number {
  const value = readEnv(name);
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const isCI = readBoolEnv('CI', false);

/**
 * Every environment variable that holds a credential or payment secret. Single source for the logger's
 * redaction, the reporter's artifact scrubbing and configuredSecrets(). Kalabash credentials are accepted
 * under the owner's names (PhoneNumber / password / pin) and the clearer KALABASH_* aliases.
 */
export const SECRET_ENV_VARS = [
  'PRIME_EMAIL', 'PRIME_PASSWORD', 'AFFILIATE_EMAIL', 'AFFILIATE_PASSWORD',
  'TEST_CARD_NUMBER', 'TEST_CARD_CVV', 'TEST_CARD_EXPIRY', 'TEST_CARD_PIN', 'TEST_CARD_OTP',
  'KALABASH_PHONE', 'KALABASH_PASSWORD', 'KALABASH_PIN', 'PhoneNumber', 'password', 'pin',
] as const;

/** Configured secret values (>= 4 characters, so short values never redact ordinary text). */
export function secretValues(): string[] {
  return SECRET_ENV_VARS.map((n) => readEnv(n)).filter((v): v is string => !!v && v.length >= 4);
}

/** Mask a secret for logs: never print the value, only whether it is present. */
export function describeSecret(name: string): string {
  return readEnv(name) ? `${name}=<set>` : `${name}=<missing>`;
}
