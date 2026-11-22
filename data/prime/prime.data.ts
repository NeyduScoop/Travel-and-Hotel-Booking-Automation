import type { PrimeTier } from '../../types/prime.types';

/** Prime tiers as exposed on /wakanow-prime (observed on DEVTEST). Prices are read live, never hardcoded. */
export const primeTiers: PrimeTier[] = [
  { slug: 'Single', heading: 'Individual', joinLinkName: 'Join Individual', joinLabel: 'Individual' },
  { slug: 'Duo', heading: 'Duo (You + Me)', joinLinkName: 'Join Duo (You + Me)', joinLabel: 'Duo' },
  { slug: 'Corporate', heading: 'Corporate', joinLinkName: 'Join Corporate', joinLabel: 'Corporate' },
];

/**
 * PRIME member pricing observed on DEVTEST (2026-11-15): flight cards show "Prime ₦X Member exclusive
 * pricing" at 10% below Full Pay (e.g. ₦2,124,461 -> ₦1,912,015); hotel cards ~2% below.
 * The rate is used only to cross-check what the UI shows, never to replace a displayed value.
 */
export const primeFlightDiscountRate = 0.1;

export const invalidEmails = ['plainaddress', 'missing-domain@', 'spaces in@example.com'];
