import { expect, type Locator } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { FilterPanel } from '../../components/filters/FilterPanel';
import { SortBar } from '../../components/sorting/SortBar';
import { timeouts } from '../../config/test.config';
import { isoDate } from '../../utils/date.utils';
import { parseNaira } from '../../utils/assertions';
import type { FlightCardSummary, FlightSearchCriteria } from '../../types/flight.types';
import type { SearchOutcome } from '../../types/common.types';

/** Card CTA: "Book Now" for guests, "Book with Prime" for signed-in PRIME members (observed 2026-11-15). */
export const FLIGHT_BOOK_CTA = /^Book (Now|with Prime)$/;

/** One row of the "Best Deals by Airline" grid: stop category -> price (or null for "—") per airline. */
export interface BestDealsRow {
  category: string;
  prices: Record<string, number | null>;
}

/**
 * /flights/search?… -> /flights/results/<searchId>?…
 * The results area is a nested <main> inside the page <main>.
 * Each itinerary is an <article> whose accessible name encodes
 * "<Airline> from <ORIG> to <DEST>, <stops>, <N> min, ₦<price>".
 * Cards of the same airline are grouped behind "+N <AIRLINE> FLIGHTS" / "Hide <Airline> flights" toggles.
 */
export class FlightResultsPage extends BasePage {
  /** "Best Deals by Airline" grid: columns = airlines, rows = Non stop / 1 Stop / 2+ Stops. */
  get bestDealsGrid(): Locator {
    return this.resultsMain.getByRole('table').first();
  }
  /** "+N <AIRLINE> FLIGHTS" expanders. */
  get groupExpanders(): Locator {
    return this.resultsMain.getByRole('button', { name: /^\+\d+ .+ FLIGHTS?$/i });
  }
  /** "Hide <Airline> flights" collapsers shown once a group is expanded. */
  get groupCollapsers(): Locator {
    return this.resultsMain.getByRole('button', { name: /^Hide .+ flights$/i });
  }

  async bestDeals(): Promise<{ airlines: string[]; rows: BestDealsRow[] }> {
    const grid = this.bestDealsGrid;
    const header = (await grid.getByRole('columnheader').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
    const airlines = header.slice(1).map((h) => h.split(' ').slice(0, Math.ceil(h.split(' ').length / 2)).join(' ') || h);
    const rows: BestDealsRow[] = [];
    for (const row of await grid.getByRole('row').all()) {
      const cells = (await row.getByRole('cell').allInnerTexts()).map((t) => t.trim());
      if (cells.length < 2) continue;
      const prices: Record<string, number | null> = {};
      cells.slice(1).forEach((c, i) => (prices[airlines[i] ?? `col${i}`] = /₦/.test(c) ? parseNaira(c) : null));
      rows.push({ category: cells[0], prices });
    }
    return { airlines, rows };
  }

  /** "Prime ₦X Member exclusive pricing" on a card (shown to guests and members). */
  async primePriceOf(card: Locator): Promise<number | null> {
    const m = /Prime\s*(₦[\d,]+)\s*Member exclusive pricing/i.exec((await card.innerText()).replace(/\s+/g, ' '));
    return m ? parseNaira(m[1]) : null;
  }

  /** Layover descriptions from the card's "Layover at <airport>, <duration>, <airline>" buttons. */
  async layoversOf(card: Locator): Promise<{ airport: string; minutes: number }[]> {
    const names = await card.getByRole('button', { name: /^Layover at / }).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? e.textContent ?? ''));
    return names.map((n) => {
      const m = /^Layover at (.+?), (\d+h(?: \d+m)?|\d+m), /.exec(n.trim());
      const dur = m?.[2] ?? '';
      const h = /(\d+)h/.exec(dur);
      const mm = /(\d+)m/.exec(dur);
      return { airport: m?.[1] ?? n, minutes: (h ? Number(h[1]) * 60 : 0) + (mm ? Number(mm[1]) : 0) };
    });
  }

  /** Departure/arrival times and day offsets per leg, read from the card's <time> elements. */
  async legTimesOf(card: Locator): Promise<{ depart: string; arrive: string; arriveDayOffset: number }[]> {
    const times = await card.locator('time').evaluateAll((els) =>
      els.map((e) => {
        const sup = e.querySelector('sup')?.textContent ?? '';
        const t = (e.textContent ?? '').replace(sup, '').trim();
        return { t, offset: Number(sup.replace('+', '') || 0) };
      }),
    );
    const legs: { depart: string; arrive: string; arriveDayOffset: number }[] = [];
    for (let i = 0; i + 1 < times.length; i += 2) legs.push({ depart: times[i].t, arrive: times[i + 1].t, arriveDayOffset: times[i + 1].offset });
    return legs;
  }

  /** Per-leg displayed durations ("6h 45m", "17h 45m", "19h") in card order. */
  async legDurationsOf(card: Locator): Promise<number[]> {
    const text = (await card.innerText()).replace(/\s+/g, ' ');
    return [...text.matchAll(/(?:^|\s)(\d{1,2}h(?: \d{1,2}m)?)(?= (?:Direct|\d+ stop|1 stop|[A-Z]{3}\b))/g)].map((m) => {
      const h = /(\d+)h/.exec(m[1]);
      const mm = /(\d+)m/.exec(m[1]);
      return (h ? Number(h[1]) * 60 : 0) + (mm ? Number(mm[1]) : 0);
    });
  }
  get loader(): Locator {
    return this.page.getByRole('status').filter({ hasText: 'Searching available flights' });
  }
  get resultsMain(): Locator {
    return this.main.getByRole('main');
  }
  get resultCount(): Locator {
    return this.resultsMain.getByText(/\d+ flights? found/);
  }
  get cards(): Locator {
    return this.resultsMain.getByRole('article').filter({ has: this.page.getByRole('button', { name: FLIGHT_BOOK_CTA }) });
  }
  get modifySearch(): Locator {
    return this.main.getByRole('button', { name: /Modify$/ });
  }
  get filters(): FilterPanel {
    return new FilterPanel(this.main.getByRole('complementary').filter({ has: this.page.getByRole('heading', { name: 'Filters' }) }));
  }
  get sort(): SortBar {
    return new SortBar(this.resultsMain);
  }

  /** Deep-link straight to the results for `criteria` (same URL the widget produces). */
  static searchPath(c: FlightSearchCriteria): string {
    const q = new URLSearchParams({
      origin: c.origin.code,
      originName: c.origin.name,
      destination: c.destination.code,
      destinationName: c.destination.name,
      tripType: c.tripType === 'Round trip' ? 'round-trip' : 'one-way',
      // Widget option values: economy | premium-economy | business | first
      cabin: c.cabin === 'First Class' ? 'first' : c.cabin.toLowerCase().replace(/\s+/g, '-'),
      departureDate: isoDate(c.departureDate),
      ...(c.returnDate ? { returnDate: isoDate(c.returnDate) } : {}),
      adults: String(c.passengers.adults),
      children: String(c.passengers.children),
      infants: String(c.passengers.infants),
    });
    return `/flights/search?${q.toString()}`;
  }

  async openFor(criteria: FlightSearchCriteria): Promise<void> {
    await this.page.goto(FlightResultsPage.searchPath(criteria), { waitUntil: 'domcontentloaded' });
  }

  /** Wait for the search to finish and classify the outcome (results vs. a valid empty state). */
  async waitForOutcome(timeout: number = timeouts.flightResults): Promise<SearchOutcome> {
    await expect(this.page).toHaveURL(/\/flights\/(results|search)/, { timeout });
    await expect(this.cards.first().or(this.resultCount).first()).toBeVisible({ timeout });
    await expect(this.loader).toBeHidden({ timeout });
    // The "N flights found" counter can render before the cards; only call it empty when N is 0.
    if ((await this.cards.count()) === 0 && (await this.resultCount.isVisible()) && (await this.foundCount()) > 0) {
      await expect(this.cards.first()).toBeVisible({ timeout });
    }
    const count = await this.cards.count();
    if (count > 0) return { kind: 'results', count };
    const message = (await this.resultsMain.innerText()).replace(/\s+/g, ' ').trim();
    return { kind: 'empty', message };
  }

  async foundCount(): Promise<number> {
    const text = await this.resultCount.innerText();
    return Number(/(\d+)/.exec(text)?.[1] ?? NaN);
  }

  async summaryOf(card: Locator): Promise<FlightCardSummary> {
    const label = (await card.getAttribute('aria-label')) ?? '';
    const m = /^(.*) from (\w{3}) to (\w{3}), ([^,]+), (\d+) min, (₦[\d,]+)/.exec(label);
    if (!m) throw new Error(`Unexpected flight card label: "${label}"`);
    const text = await card.innerText();
    const baggage = [...text.matchAll(/\d+\s*×\s*\d+\s*kg\s*(?:cabin|checked)/gi)].map((b) => b[0].replace(/\s+/g, ' '));
    return {
      airline: m[1].trim(),
      origin: m[2],
      destination: m[3],
      stopsLabel: m[4].trim(),
      durationMinutes: Number(m[5]),
      price: parseNaira(m[6]),
      baggage,
    };
  }

  async summaries(): Promise<FlightCardSummary[]> {
    const cards = await this.cards.all();
    return Promise.all(cards.map((c) => this.summaryOf(c)));
  }

  card(index: number): Locator {
    return this.cards.nth(index);
  }

  /** Wait until the visible card list changes after a filter/sort interaction. */
  async waitForListToSettle(previousFirstLabel: string | null): Promise<void> {
    await expect(this.loader).toBeHidden({ timeout: timeouts.flightResults });
    if (previousFirstLabel !== null) {
      await expect
        .poll(async () => (await this.cards.count()) === 0 || (await this.cards.first().getAttribute('aria-label')) !== previousFirstLabel, {
          timeout: 10_000,
        })
        .toBeTruthy()
        .catch(() => undefined); // order may legitimately be unchanged
    }
  }
}
