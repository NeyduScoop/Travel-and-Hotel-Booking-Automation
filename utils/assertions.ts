import { expect, type Locator } from '@playwright/test';

/** Parse "₦1,169,827" (or "NGN10,000") into 1169827. Throws if no amount is present. */
export function parseNaira(text: string): number {
  const match = /(?:₦|NGN)\s*([\d,]+(?:\.\d+)?)/.exec(text);
  if (!match) throw new Error(`No Naira amount found in "${text}"`);
  return Number(match[1].replace(/,/g, ''));
}

/** All Naira amounts in a string, in order of appearance. */
export function parseAllNaira(text: string): number[] {
  return [...text.matchAll(/(?:₦|NGN)\s*([\d,]+(?:\.\d+)?)/g)].map((m) => Number(m[1].replace(/,/g, '')));
}

export function expectAscending(values: number[], label: string): void {
  const sorted = [...values].sort((a, b) => a - b);
  expect(values, `${label} should be in ascending order`).toEqual(sorted);
}

export function expectDescending(values: number[], label: string): void {
  const sorted = [...values].sort((a, b) => b - a);
  expect(values, `${label} should be in descending order`).toEqual(sorted);
}

/** Money equality with an explicit rounding tolerance (default: 1 Naira for display rounding). */
export function expectAmountClose(actual: number, expected: number, label: string, tolerance = 1): void {
  expect(
    Math.abs(actual - expected),
    `${label}: expected ₦${expected.toLocaleString()} (±${tolerance}), got ₦${actual.toLocaleString()}`,
  ).toBeLessThanOrEqual(tolerance);
}

/** Assert that a field shows an accessible validation message (role="alert"). */
export async function expectFieldError(scope: Locator, message: string | RegExp): Promise<void> {
  await expect(scope.getByRole('alert').filter({ hasText: message }).first()).toBeVisible();
}

/** Every visible text in `texts` must match `pattern`. */
export function expectAllMatch(texts: string[], pattern: RegExp, label: string): void {
  const offenders = texts.filter((t) => !pattern.test(t));
  expect(offenders, `${label}: entries not matching ${pattern}`).toEqual([]);
}
