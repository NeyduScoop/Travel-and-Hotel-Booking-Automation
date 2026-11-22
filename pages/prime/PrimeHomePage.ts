import { expect, type Locator } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { parseNaira } from '../../utils/assertions';
import type { PrimeTier } from '../../types/prime.types';

/** /wakanow-prime — WakaPrime landing page with three tiers, benefits, steps and FAQ. */
export class PrimeHomePage extends BasePage {
  get heroHeading(): Locator {
    return this.main.getByRole('heading', { name: 'Access More. Pay Less.', level: 1 });
  }
  get joinPrimeButton(): Locator {
    return this.main.getByRole('button', { name: 'Join Prime', exact: true });
  }
  get tiersHeading(): Locator {
    return this.main.getByRole('heading', { name: /Three tiers/, level: 2 });
  }
  tierHeading(tier: PrimeTier): Locator {
    return this.main.getByRole('heading', { name: tier.heading, level: 3, exact: true });
  }
  joinLink(tier: PrimeTier): Locator {
    return this.main.getByRole('link', { name: tier.joinLinkName, exact: true });
  }
  /** The tier card is the nearest ancestor of the heading that also contains its join link. */
  tierCard(tier: PrimeTier): Locator {
    // Nearest ancestor of the tier heading that also contains a "Join …" link = that tier's card.
    return this.tierHeading(tier).locator('xpath=ancestor::*[.//a[starts-with(normalize-space(.),"Join ")]][1]');
  }
  get faqHeading(): Locator {
    return this.main.getByRole('heading', { name: /Asked and/, level: 2 });
  }
  get serviceArticles(): Locator {
    return this.main.getByRole('article');
  }

  async openPrime(): Promise<void> {
    await this.open('/wakanow-prime');
    await expect(this.heroHeading).toBeVisible();
  }

  async annualPrice(tier: PrimeTier): Promise<number> {
    const text = await this.tierCard(tier).innerText();
    const m = /(₦[\d,]+)\s*\/\s*year/.exec(text);
    if (!m) throw new Error(`No annual price for tier ${tier.heading}`);
    return parseNaira(m[1]);
  }

  async benefits(tier: PrimeTier): Promise<string[]> {
    return (await this.tierCard(tier).getByRole('listitem').allInnerTexts()).map((t) => t.trim());
  }
}
