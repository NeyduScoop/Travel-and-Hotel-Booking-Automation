import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { FilterPanel } from '../../components/filters/FilterPanel';
import { SortBar } from '../../components/sorting/SortBar';
import { timeouts } from '../../config/test.config';
import { parseAllNaira, parseNaira } from '../../utils/assertions';
import { UMRAH_BADGE } from '../../data/hotels/hotel.data';
import type { HotelCardSummary } from '../../types/hotel.types';
import type { SearchOutcome } from '../../types/common.types';

/** /hotels/results/<key>?… — hotel listing with filters, sort buttons and "View Deal" cards. */
export class HotelResultsPage extends BasePage {
  get resultsMain(): Locator {
    return this.main.getByRole('main');
  }
  get searching(): Locator {
    return this.resultsMain.getByText('Searching...', { exact: true });
  }
  get showingCount(): Locator {
    return this.resultsMain.getByText(/^Showing \d+ of \d+ hotels?$/);
  }
  get endOfResults(): Locator {
    return this.resultsMain.getByText("You've reached the end of the results");
  }
  get cards(): Locator {
    return this.resultsMain.getByRole('article').filter({ has: this.page.getByRole('button', { name: 'View Deal' }) });
  }
  get modifySearch(): Locator {
    return this.main.getByRole('button', { name: /Modify$/ });
  }
  get filters(): FilterPanel {
    return new FilterPanel(this.main.getByRole('complementary').filter({ has: this.page.getByRole('heading', { name: 'Filters' }) }));
  }
  get nameFilter(): Locator {
    return this.filters.root.getByRole('textbox', { name: 'Search by name' });
  }
  get sort(): SortBar {
    return new SortBar(this.resultsMain);
  }

  async waitForOutcome(timeout: number = timeouts.hotelResults): Promise<SearchOutcome> {
    await expect(this.page).toHaveURL(/\/hotels\/(results|search)/, { timeout });
    await expect(this.searching).toBeHidden({ timeout });
    await expect(this.cards.first().or(this.showingCount).or(this.endOfResults).first()).toBeVisible({ timeout });
    const count = await this.cards.count();
    if (count > 0) return { kind: 'results', count };
    return { kind: 'empty', message: (await this.resultsMain.innerText()).replace(/\s+/g, ' ').trim() };
  }

  async showing(): Promise<{ shown: number; total: number }> {
    const m = /Showing (\d+) of (\d+)/.exec(await this.showingCount.innerText());
    return { shown: Number(m?.[1]), total: Number(m?.[2]) };
  }

  async summaryOf(card: Locator): Promise<HotelCardSummary> {
    const name = (await card.getByRole('heading', { level: 3 }).innerText()).trim();
    const text = (await card.innerText()).replace(/\s+/g, ' ');
    const nights = Number(/(\d+) nights?/.exec(text)?.[1]);
    // Order on the card: "<N> nights ₦TOTAL ₦PER/night Prime ₦PRIME …"
    const [totalPrice, perNightPrice] = parseAllNaira(text);
    // The badge is CSS upper-cased ("UMRAH APPROVED") in innerText, so compare case-insensitively.
    const umrahApproved = text.toLowerCase().includes(UMRAH_BADGE.toLowerCase());
    const prime = /PRIME\s*(₦[\d,]+)/i.exec(text);
    return { name, umrahApproved, nights, totalPrice, perNightPrice, primePrice: prime ? parseNaira(prime[1]) : undefined };
  }

  async summaries(): Promise<HotelCardSummary[]> {
    return Promise.all((await this.cards.all()).map((c) => this.summaryOf(c)));
  }

  /** Click "View Deal"; the hotel opens in a NEW TAB (Project.md §11). Returns the new page. */
  async openDeal(card: Locator): Promise<Page> {
    const popup = this.page.context().waitForEvent('page', { timeout: 30_000 });
    await card.getByRole('button', { name: 'View Deal' }).click();
    const newPage = await popup;
    await newPage.waitForLoadState('domcontentloaded');
    return newPage;
  }
}
