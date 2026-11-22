import type { Locator } from '@playwright/test';

/**
 * Sort controls rendered as buttons above result lists:
 * Flights "Cheapest/Fastest/Earliest", Hotels "Recommended/Price ↑/Price ↓/Rating",
 * Tours group "Sort tours" with "Price (low–high)/Price (high–low)".
 */
export class SortBar {
  constructor(private readonly scope: Locator) {}

  option(name: string | RegExp): Locator {
    return this.scope.getByRole('button', { name });
  }

  async choose(name: string | RegExp): Promise<void> {
    await this.option(name).first().click();
  }
}
