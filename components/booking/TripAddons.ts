import { expect, type Locator } from '@playwright/test';
import { parseNaira } from '../../utils/assertions';

export interface TripAddon {
  name: string;
  price: number;
  selected: boolean;
}

/**
 * "Enhance Your Trip" add-ons on the cart (flights, hotels, packages). Each add-on is an h3 with a
 * price and an "Add" / "Remove" button; some (e.g. Call Reminder, SMS Reminder) are pre-selected.
 */
export class TripAddons {
  readonly heading: Locator;

  constructor(private readonly scope: Locator) {
    this.heading = scope.getByRole('heading', { name: 'Enhance Your Trip', level: 2 });
  }

  /** The add-on card: nearest ancestor of its h3 that also holds its Add/Remove button. */
  card(name: string): Locator {
    return this.scope
      .getByRole('heading', { name, level: 3, exact: true })
      .locator('xpath=ancestor::*[.//button[normalize-space()="Add" or normalize-space()="Remove"]][1]');
  }

  async list(): Promise<TripAddon[]> {
    if (!(await this.heading.isVisible())) return [];
    const headings = this.heading.locator('xpath=ancestor::*[.//h3][1]').getByRole('heading', { level: 3 });
    const names = (await headings.allInnerTexts()).map((t) => t.trim());
    const out: TripAddon[] = [];
    for (const name of names) {
      const card = this.card(name);
      if (!(await card.count())) continue;
      const text = (await card.innerText()).replace(/\s+/g, ' ');
      const price = /₦[\d,]+/.exec(text);
      if (!price) continue;
      out.push({ name, price: parseNaira(price[0]), selected: await card.getByRole('button', { name: 'Remove', exact: true }).isVisible() });
    }
    return out;
  }

  async add(name: string): Promise<void> {
    await this.card(name).getByRole('button', { name: 'Add', exact: true }).click();
    await expect(this.card(name).getByRole('button', { name: 'Remove', exact: true })).toBeVisible();
  }

  async remove(name: string): Promise<void> {
    await this.card(name).getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(this.card(name).getByRole('button', { name: 'Add', exact: true })).toBeVisible();
  }
}
