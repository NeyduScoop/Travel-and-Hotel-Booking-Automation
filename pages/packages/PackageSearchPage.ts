import { expect, type Locator } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { LocationAutocomplete } from '../../components/search/LocationAutocomplete';
import { DatePicker } from '../../components/date-picker/DatePicker';
import { TravellerSelector } from '../../components/passengers/TravellerSelector';
import type { PackageDestinationAttempt, PackageSearchCriteria } from '../../types/package.types';

/**
 * /packages — "Holiday Packages" search (From, Destination city, Departure/Return, Travelers,
 * "Build a package"). Observed 2026-11-15: building a package opens the hotel step at
 * /hotels/search?context=holidays&… and then the flight step at /flights/results/…?context=holidays.
 */
export class PackageSearchPage extends BasePage {
  readonly from = new LocationAutocomplete(this.page, this.main, 'From');
  readonly destination = new LocationAutocomplete(this.page, this.main, 'Destination city');
  readonly dates = new DatePicker(this.page, this.main);
  readonly travellers = new TravellerSelector(this.main);

  get heading(): Locator {
    return this.main.getByRole('heading', { name: 'Holiday Packages', level: 1 });
  }
  get buildButton(): Locator {
    return this.main.getByRole('button', { name: 'Build a package' });
  }

  async openSearch(): Promise<void> {
    await this.open('/packages');
    await expect(this.heading).toBeVisible();
  }

  async selectDeparture(code: string, query: string): Promise<string> {
    return this.from.select(query, code, code);
  }

  /** Pick the first suggestion whose primary name is the destination (e.g. "Medina, Saudi Arabia" before "Medina, USA"). */
  async selectDestination(destination: string): Promise<string> {
    await this.destination.search(destination);
    const options = this.destination.options;
    const exact = options.filter({ has: this.page.locator('.wk-location__option-name', { hasText: new RegExp(`^\\s*${destination}\\s*$`, 'i') }) });
    await ((await exact.count()) ? exact.first() : options.filter({ hasText: new RegExp(destination, 'i') }).first()).click();
    return this.destination.value();
  }

  async fill(c: PackageSearchCriteria): Promise<void> {
    await this.selectDeparture(c.departure.code, c.departure.name);
    await this.selectDestination(c.destination);
    await this.dates.selectRange('Departure', c.departureDate, 'Return', c.returnDate);
    await this.travellers.open();
    await this.travellers.setCount('adult', c.adults);
    await this.travellers.done();
  }

  async build(): Promise<void> {
    await this.buildButton.click();
    await expect(this.page).toHaveURL(/context=holidays/, { timeout: 60_000 });
  }

  /** Whether the destination autocomplete offers anything for `destination`. */
  /**
   * Fill the search for one candidate destination; false when the destination is not offered.
   * (Searching the same term twice leaves the suggestion list empty, so there is no separate pre-check.)
   */
  async tryFill(c: PackageSearchCriteria): Promise<boolean> {
    try {
      await this.fill(c);
      return true;
    } catch {
      return false;
    }
  }
}

/** Ordered record of every package destination tried (Project.md §12). */
export class PackageFallbackLog {
  readonly attempts: PackageDestinationAttempt[] = [];

  record(attempt: PackageDestinationAttempt): void {
    this.attempts.push(attempt);
  }

  summary(): string {
    return this.attempts.map((a) => `${a.destination}: ${a.outcome}${a.reason ? ` (${a.reason})` : ''}`).join(' -> ');
  }
}
