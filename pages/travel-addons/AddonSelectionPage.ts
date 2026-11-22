import { expect, type Locator } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { CartPage } from '../common/CartPage';
import { parseNaira } from '../../utils/assertions';
import type { SelectedAddonLine } from '../../types/addon.types';

/** "Selected extras" side panel on /extras and the hand-off to the cart. */
export class AddonSelectionPage extends BasePage {
  readonly cart = new CartPage(this.page);

  get panel(): Locator {
    return this.page.getByRole('complementary', { name: 'Selected extras' });
  }
  get emptyHeading(): Locator {
    return this.panel.getByRole('heading', { name: 'Your selections will appear here' });
  }
  get selectionsHeading(): Locator {
    return this.panel.getByRole('heading', { name: 'Your selections' });
  }
  get items(): Locator {
    return this.panel.getByRole('listitem');
  }
  get continueToCart(): Locator {
    return this.panel.getByRole('button', { name: 'Continue to cart' });
  }
  removeButton(name: string): Locator {
    return this.panel.getByRole('button', { name: `Remove ${name}`, exact: true });
  }

  async itemCountLabel(): Promise<number> {
    // Labels such as "2 ITEMS" / "TOTAL" are CSS upper-cased in innerText.
    return Number(/(\d+) items?/i.exec(await this.panel.innerText())?.[1] ?? 0);
  }

  /** Parse "Name LOS · ₦25,000 × 1 ₦25,000" lines. */
  async lines(): Promise<SelectedAddonLine[]> {
    const items = await this.items.all();
    return Promise.all(
      items.map(async (item) => {
        const name = (await item.locator('strong').first().innerText()).trim();
        const text = (await item.innerText()).replace(/\s+/g, ' ');
        const m = /(₦[\d,]+)\s*×\s*(\d+)\s*(₦[\d,]+)/.exec(text);
        if (!m) throw new Error(`Unexpected selection line: "${text}"`);
        return { name, unitPrice: parseNaira(m[1]), quantity: Number(m[2]), lineTotal: parseNaira(m[3]) };
      }),
    );
  }

  async total(): Promise<number> {
    const m = /Total\s*(₦[\d,]+)/i.exec((await this.panel.innerText()).replace(/\s+/g, ' '));
    if (!m) throw new Error('No total in Selected extras panel');
    return parseNaira(m[1]);
  }

  async proceedToCart(): Promise<CartPage> {
    await this.continueToCart.click();
    await this.cart.waitForReady();
    return this.cart;
  }

  async expectItemCount(n: number): Promise<void> {
    await expect(this.items).toHaveCount(n);
  }
}
