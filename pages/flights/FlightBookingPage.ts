import { expect, test, type Locator } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { FLIGHT_BOOK_CTA } from './FlightResultsPage';
import { CartPage } from '../common/CartPage';
import { FlightResultsPage } from './FlightResultsPage';
import { timeouts } from '../../config/test.config';
import type { FlightCardSummary } from '../../types/flight.types';

export interface FlightSelectionAttempt {
  index: number;
  label: string;
  outcome: 'selected' | 'failed';
  error?: string;
}

/**
 * Flight selection -> checkout hand-off. "Book Now" calls the Select API and lands on /cart.
 * Implements the Project.md §8 selection rule: try the first flight; on failure record it,
 * return to the results and try the next reasonable flight.
 */
export class FlightBookingPage extends BasePage {
  readonly results = new FlightResultsPage(this.page);
  readonly cart = new CartPage(this.page);

  bookNow(card: Locator): Locator {
    return card.getByRole('button', { name: FLIGHT_BOOK_CTA });
  }

  async selectFlight(card: Locator): Promise<CartPage> {
    // Selection can surface the app's "Something went wrong" dialog under load; its "Try Again" is used.
    await this.withAppRetry(() => this.bookNow(card).click(), this.cart.contact.email, 1, timeouts.cart);
    await this.cart.waitForReady();
    return this.cart;
  }

  /**
   * Owner rule (2026-11-22): if a flight cannot be selected, record the error and move to the next flight on the
   * listing (e.g. Kenya Airways fails → try Ethiopian Airlines). Each failure is recorded as a
   * `flight-selection-failure` annotation with a screenshot. Flights are tracked by their card label, so a
   * re-ordered listing after the reload never retries a failed flight or skips an untried one.
   * `inspect` runs on each card just before it is selected, so callers can read details of the flight actually booked.
   */
  async selectFirstBookable(maxAttempts = 5, inspect?: (card: Locator) => Promise<void>): Promise<{ summary: FlightCardSummary; attempts: FlightSelectionAttempt[] }> {
    const attempts: FlightSelectionAttempt[] = [];
    const tried = new Set<string>();
    const resultsUrl = this.page.url();
    while (attempts.length < maxAttempts) {
      const count = await this.results.cards.count();
      let index = -1;
      let label = '';
      for (let i = 0; i < count; i += 1) {
        const l = (await this.results.card(i).getAttribute('aria-label')) ?? `card ${i}`;
        if (!tried.has(l)) { index = i; label = l; break; }
      }
      if (index < 0) break;
      tried.add(label);
      const card = this.results.card(index);
      const summary = await this.results.summaryOf(card);
      if (inspect) await inspect(card);
      try {
        await this.selectFlight(card);
        attempts.push({ index, label, outcome: 'selected' });
        return { summary, attempts };
      } catch (error) {
        const message = (error as Error).message.split('\n')[0];
        attempts.push({ index, label, outcome: 'failed', error: message });
        await this.recordSelectionFailure(label, message);
        await this.page.goto(resultsUrl, { waitUntil: 'domcontentloaded' });
        await expect(this.results.cards.first()).toBeVisible({ timeout: timeouts.flightResults });
      }
    }
    throw new Error(`No flight could be selected. Attempts: ${JSON.stringify(attempts)}`);
  }

  /** Evidence for a flight that could not be selected; never overwrites earlier evidence. */
  private async recordSelectionFailure(label: string, message: string): Promise<void> {
    let info: ReturnType<typeof test.info> | undefined;
    try { info = test.info(); } catch { return; } // outside a test (e.g. a script): nothing to record
    info.annotations.push({ type: 'flight-selection-failure', description: `${label}: ${message} → moving to the next flight` });
    // E-mail addresses masked: signed-in pages show the account e-mail.
    const shot = await this.page.screenshot({ fullPage: false, mask: [this.page.getByText(/[\w.+-]+@[\w-]+\.[\w.]+/)] }).catch(() => undefined);
    if (shot) await info.attach(`flight-selection-failure-${info.annotations.filter((a) => a.type === 'flight-selection-failure').length}.png`, { body: shot, contentType: 'image/png' });
  }
}
