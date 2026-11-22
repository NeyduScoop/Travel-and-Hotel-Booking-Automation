import { expect, type Locator, type Page } from '@playwright/test';
import { timeouts } from '../../config/test.config';

/**
 * Wakanow location autocomplete (`wk-location` component), used by Flights (From/To),
 * Hotels (Destination), Tours (Country/Destination), Visa (Passport country/Destination)
 * and Travel Add-ons (From).
 *
 * Observed DOM: input[role=combobox] labelled by its <label>; suggestions render as
 * div[role=listbox] > li[role=option] containing the IATA/country code and the place name.
 */
export class LocationAutocomplete {
  readonly input: Locator;

  constructor(private readonly page: Page, scope: Locator, label: string) {
    this.input = scope.getByRole('combobox', { name: label, exact: true });
  }

  /** The suggestion list that is currently open. */
  get listbox(): Locator {
    return this.page.getByRole('listbox').filter({ visible: true }).first();
  }

  get options(): Locator {
    return this.listbox.getByRole('option');
  }

  /** Type a query and wait for suggestions. Retries when typing is lost to Angular hydration. */
  async search(query: string): Promise<void> {
    await expect(async () => {
      await this.input.click();
      await this.input.fill('');
      await this.input.pressSequentially(query, { delay: 50 });
      await expect(this.options.first()).toBeVisible({ timeout: 8_000 });
    }).toPass({ timeout: timeouts.autocomplete, intervals: [500, 1_000, 2_000] });
  }

  /** Search and pick the option whose text matches `option`; verifies the field value afterwards. */
  async select(query: string, option: string | RegExp, expectedValue: string | RegExp = option): Promise<string> {
    await this.search(query);
    // An IATA code must match the option's code glyph exactly. Grouped city options such as
    // "LON - London All Airports" nest their airports as inner options, so only innermost
    // options (those containing no other option) are considered.
    const leaves = this.options.filter({ hasNot: this.page.getByRole('option') });
    const matcher =
      typeof option === 'string' && /^[A-Z]{3}$/.test(option)
        ? leaves.filter({ has: this.page.getByText(option, { exact: true }) })
        : leaves.filter({ hasText: option });
    await matcher.first().click();
    await expect(this.input).toHaveValue(typeof expectedValue === 'string' ? new RegExp(escape(expectedValue)) : expectedValue);
    return this.input.inputValue();
  }

  /** Texts of all suggestions for a query (empty array when none are offered). */
  async suggestionsFor(query: string, settleMs = 4_000): Promise<string[]> {
    await this.input.click();
    await this.input.fill('');
    await this.input.pressSequentially(query, { delay: 50 });
    try {
      await this.options.first().waitFor({ state: 'visible', timeout: settleMs });
    } catch {
      return [];
    }
    return (await this.options.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
  }

  /** Open the list without typing and return every option (used for fixed lists such as visa destinations). */
  async allOptions(): Promise<string[]> {
    await expect(async () => {
      await this.input.click();
      await expect(this.options.first()).toBeVisible({ timeout: 8_000 });
    }).toPass({ timeout: timeouts.autocomplete });
    return (await this.options.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
  }

  async value(): Promise<string> {
    return this.input.inputValue();
  }

  async close(): Promise<void> {
    await this.page.keyboard.press('Escape');
  }
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
