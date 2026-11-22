import type { Locator } from '@playwright/test';
import { parseNaira } from '../../utils/assertions';

/**
 * Right-hand price summary shown on the cart ("Total ₦X" + "Proceed to Pay ₦X"),
 * the visa order summary ("Get Started ₦X") and the Prime join page.
 */
export class OrderSummary {
  constructor(readonly root: Locator) {}

  /** Primary call-to-action, e.g. "Proceed to Pay ₦1,169,827" or "Get Started ₦384,500". */
  cta(name: RegExp): Locator {
    return this.root.getByRole('button', { name });
  }

  async text(): Promise<string> {
    return (await this.root.innerText()).replace(/\s+/g, ' ').trim();
  }

  /** Last "Total ₦X" value in the summary. */
  async total(): Promise<number> {
    const text = await this.text();
    const matches = [...text.matchAll(/Total(?: today)?\s*(₦[\d,]+)/g)];
    if (!matches.length) throw new Error(`No total in summary: "${text}"`);
    return parseNaira(matches[matches.length - 1][1]);
  }

  async ctaAmount(name: RegExp): Promise<number> {
    return parseNaira(await this.cta(name).innerText());
  }
}
