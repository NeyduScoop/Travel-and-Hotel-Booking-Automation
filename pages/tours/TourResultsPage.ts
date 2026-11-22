import { expect, type Locator } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { FilterPanel } from '../../components/filters/FilterPanel';
import { SortBar } from '../../components/sorting/SortBar';
import { timeouts } from '../../config/test.config';
import { isoDate } from '../../utils/date.utils';
import { parseNaira } from '../../utils/assertions';
import type { TourCardSummary, TourCategory, TourSearchCriteria } from '../../types/tour.types';
import type { SearchOutcome } from '../../types/common.types';

/** /tours/results?… — tour listing with category/duration/rating/price filters and price sort. */
export class TourResultsPage extends BasePage {
  get heading(): Locator {
    return this.main.getByRole('heading', { level: 1 });
  }
  get resultsMain(): Locator {
    return this.main.getByRole('main', { name: 'Tour results' });
  }
  get foundCount(): Locator {
    // The live-region text is padded with whitespace, so the pattern is not anchored.
    return this.resultsMain.getByText(/\d+ experiences? found/);
  }
  get cards(): Locator {
    return this.resultsMain.getByRole('article').filter({ has: this.page.getByRole('button', { name: /^View details for/ }) });
  }
  get filters(): FilterPanel {
    return new FilterPanel(this.main.getByRole('complementary', { name: 'Filter tours' }));
  }
  get categoryChips(): Locator {
    return this.resultsMain.getByRole('group', { name: 'Filter by category' });
  }
  get sort(): SortBar {
    return new SortBar(this.resultsMain.getByRole('group', { name: 'Sort tours' }));
  }

  static searchPath(c: TourSearchCriteria, destinationCode: string, countryCode: string): string {
    const q = new URLSearchParams({
      country: countryCode,
      destination: c.destination,
      city: c.destination,
      destinationCode,
      geographyId: destinationCode,
      startDate: isoDate(c.startDate),
      endDate: isoDate(c.endDate),
      adults: String(c.adults),
      children: '0',
      infants: '0',
    });
    return `/tours/results?${q.toString()}`;
  }

  async waitForOutcome(timeout: number = timeouts.tourResults): Promise<SearchOutcome> {
    await expect(this.page).toHaveURL(/\/tours\/results/, { timeout });
    await expect(this.cards.first().or(this.foundCount).first()).toBeVisible({ timeout });
    const count = await this.cards.count();
    if (count > 0) return { kind: 'results', count };
    return { kind: 'empty', message: (await this.resultsMain.innerText()).replace(/\s+/g, ' ').trim() };
  }

  async experiencesFound(): Promise<number> {
    return Number(/(\d+)/.exec(await this.foundCount.innerText())?.[1]);
  }

  async summaryOf(card: Locator): Promise<TourCardSummary> {
    const title = (await card.getByRole('heading', { level: 3 }).innerText()).trim();
    const text = (await card.innerText()).replace(/\s+/g, ' ');
    const m = /From\s*(₦[\d,]+)\s*\/\s*adult/.exec(text);
    if (!m) throw new Error(`No "From ₦X / adult" price on tour card "${title}"`);
    return { title, fromPricePerAdult: parseNaira(m[1]) };
  }

  async summaries(): Promise<TourCardSummary[]> {
    return Promise.all((await this.cards.all()).map((c) => this.summaryOf(c)));
  }

  async filterByCategory(category: TourCategory): Promise<void> {
    await this.filters.chooseRadio(category);
  }

  async openDetails(card: Locator): Promise<void> {
    await card.getByRole('button', { name: /^View details for/ }).click();
  }
}
