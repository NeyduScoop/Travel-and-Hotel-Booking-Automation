import { expect, type Locator } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { parseNaira } from '../../utils/assertions';
import type { PrimeTier, PrimeTierSlug } from '../../types/prime.types';

/**
 * /wakanow-prime/join/<Single|Duo|Corporate> — membership signup.
 * An "Enter your email to continue" dialog gates the form; its "Continue" button stays
 * disabled until a valid email is entered. Pressing Continue sends a real OTP email, so the
 * automation validates the gate but never submits it (Project.md §41 is a separate,
 * DEVTEST-only, payment-bearing workflow that requires explicit authorization).
 */
export class PrimeMembershipPage extends BasePage {
  get backToPlans(): Locator {
    return this.main.getByRole('link', { name: '← Back to plans' });
  }
  get heading(): Locator {
    return this.main.getByRole('heading', { name: /^Join WakaPrime/, level: 1 });
  }
  get memberInfoHeading(): Locator {
    return this.main.getByRole('heading', { name: 'Member information', level: 2 });
  }
  get coverageText(): Locator {
    return this.main.getByText(/registered traveller\(s\) are covered by this plan/);
  }
  get travellerHeadings(): Locator {
    return this.main.getByRole('heading', { name: /^Traveller \d+$/, level: 3 });
  }
  get continueToPayment(): Locator {
    return this.main.getByRole('button', { name: 'Continue to payment' });
  }
  get orderSummary(): Locator {
    return this.main.getByRole('complementary').filter({ hasText: 'Order summary' });
  }
  get emailGate(): Locator {
    return this.page.getByRole('dialog').filter({ has: this.page.getByRole('heading', { name: 'Enter your email to continue' }) });
  }
  get gateEmail(): Locator {
    return this.emailGate.getByRole('textbox', { name: 'Email address' });
  }
  get gateContinue(): Locator {
    return this.emailGate.getByRole('button', { name: 'Continue', exact: true });
  }
  memberField(name: 'Title' | 'First name' | 'Last name' | 'Email' | 'Phone', index = 0): Locator {
    const role = name === 'Title' ? 'combobox' : 'textbox';
    return this.main.getByRole(role, { name, exact: true }).nth(index);
  }

  async openJoin(slug: PrimeTierSlug): Promise<void> {
    await this.goto(`/wakanow-prime/join/${slug}`);
    await expect(this.heading).toBeVisible();
  }

  async tierLabelMatches(tier: PrimeTier): Promise<boolean> {
    return (await this.heading.innerText()).includes(tier.joinLabel);
  }

  async coveredTravellers(): Promise<number> {
    return Number(/(\d+) registered traveller/.exec(await this.coverageText.innerText())?.[1]);
  }

  async summaryAmounts(): Promise<{ subtotal: number; total: number; text: string }> {
    const text = (await this.orderSummary.innerText()).replace(/\s+/g, ' ');
    const subtotal = /Subtotal\s*(₦[\d,]+)/.exec(text);
    const total = /Total today\s*(₦[\d,]+)/.exec(text);
    if (!subtotal || !total) throw new Error(`Unexpected order summary: "${text}"`);
    return { subtotal: parseNaira(subtotal[1]), total: parseNaira(total[1]), text };
  }
}
