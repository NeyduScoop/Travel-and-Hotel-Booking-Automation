import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Searchable country picker (`wk-cs`) used for Nationality, Issuing Country and Country of arrival.
 * The trigger is a button named by its label; it opens a dialog with a "Search country" input
 * and a listbox of countries.
 */
export class CountrySelect {
  readonly trigger: Locator;

  constructor(private readonly page: Page, scope: Locator, label: string, index = 0) {
    this.trigger = scope.getByRole('button', { name: label, exact: true }).nth(index);
  }

  private get dialog(): Locator {
    return this.page.getByRole('dialog').filter({ has: this.page.getByPlaceholder('Search country') }).filter({ visible: true }).first();
  }

  /** Retried as a unit: the list can render after the search text, or the click can land mid-render. */
  async select(country: string): Promise<void> {
    await expect(async () => {
      if (!(await this.dialog.isVisible())) await this.trigger.click();
      await expect(this.dialog).toBeVisible({ timeout: 5_000 });
      await this.dialog.getByPlaceholder('Search country').fill(country);
      await this.dialog.getByRole('option', { name: country, exact: true }).first().click({ timeout: 5_000 });
      await expect(this.trigger).toContainText(country, { timeout: 5_000 });
    }).toPass({ timeout: 30_000 });
  }

  async value(): Promise<string> {
    return (await this.trigger.innerText()).trim();
  }
}
