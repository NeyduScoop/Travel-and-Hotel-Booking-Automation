import { expect, type Locator } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { LocationAutocomplete } from '../../components/search/LocationAutocomplete';
import { DatePicker } from '../../components/date-picker/DatePicker';
import { TravellerSelector } from '../../components/passengers/TravellerSelector';
import { timeouts } from '../../config/test.config';
import { parseNaira } from '../../utils/assertions';
import type { AddonCardSummary } from '../../types/addon.types';
import type { PassengerCounts, SearchOutcome } from '../../types/common.types';

/** /extras — "Travel Extras" (Travel Add-ons): airport add-ons for a departure airport/date. */
export class TravelAddonsPage extends BasePage {
  readonly from = new LocationAutocomplete(this.page, this.main, 'From');
  readonly dates = new DatePicker(this.page, this.main);
  readonly passengers = new TravellerSelector(this.main);

  get heading(): Locator {
    return this.main.getByRole('heading', { name: 'Travel Extras', level: 1 });
  }
  get searchButton(): Locator {
    return this.main.getByRole('button', { name: 'Search extras' });
  }
  get emptyPrompt(): Locator {
    return this.main.getByText('Choose a departure airport and travel date above to see available extras.');
  }
  get resultsHeading(): Locator {
    return this.main.getByRole('heading', { name: /^Airport Add-Ons/, level: 2 });
  }
  get cards(): Locator {
    return this.main.getByRole('article').filter({ has: this.page.getByRole('heading', { level: 3 }) }).filter({
      has: this.page.getByRole('button', { name: 'View terms' }),
    });
  }

  async openAddons(): Promise<void> {
    await this.open('/extras');
    await expect(this.heading).toBeVisible();
  }

  async selectDeparture(code: string, query: string): Promise<string> {
    return this.from.select(query, code, code);
  }

  async setPassengers(pax: PassengerCounts): Promise<void> {
    await this.passengers.open();
    await this.passengers.setCount('adult', pax.adults);
    await this.passengers.setCount('child', pax.children);
    await this.passengers.setCount('infant', pax.infants);
    await this.passengers.done();
  }

  async search(code: string, query: string, departure: Date): Promise<void> {
    await this.selectDeparture(code, query);
    await this.dates.selectDate('Departure', departure);
    await this.searchButton.click();
  }

  async waitForOutcome(timeout: number = timeouts.addonResults): Promise<SearchOutcome> {
    await expect(this.page).toHaveURL(/\/extras\?.*origin=/, { timeout });
    await expect(this.resultsHeading).toBeVisible({ timeout });
    await expect(this.cards.first().or(this.main.getByText(/no (add-ons|extras)/i)).first()).toBeVisible({ timeout });
    const count = await this.cards.count();
    if (count > 0) return { kind: 'results', count };
    return { kind: 'empty', message: (await this.main.innerText()).replace(/\s+/g, ' ') };
  }

  card(name: string): Locator {
    return this.cards.filter({ has: this.page.getByRole('heading', { name, level: 3, exact: true }) });
  }

  async summaryOf(card: Locator): Promise<AddonCardSummary> {
    const name = (await card.getByRole('heading', { level: 3 }).innerText()).trim();
    // "Adult" is a separately styled label (rendered upper-case), so match case-insensitively.
    const m = /Adult\s*(₦[\d,]+)/i.exec((await card.innerText()).replace(/\s+/g, ' '));
    if (!m) throw new Error(`No adult price on add-on "${name}"`);
    return { name, unitPrice: parseNaira(m[1]) };
  }

  async add(card: Locator): Promise<void> {
    await card.getByRole('button', { name: 'Add', exact: true }).click();
  }
}
