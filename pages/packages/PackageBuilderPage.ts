import { expect, test, type Locator, type Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { HotelResultsPage } from '../hotels/HotelResultsPage';
import { HotelDetailsPage, type RoomSummary } from '../hotels/HotelDetailsPage';
import { FlightResultsPage, FLIGHT_BOOK_CTA } from '../flights/FlightResultsPage';
import { CartPage } from '../common/CartPage';
import { timeouts } from '../../config/test.config';
import type { FlightCardSummary } from '../../types/flight.types';
import type { HotelCardSummary } from '../../types/hotel.types';

/**
 * Holiday builder ("Building your holiday · Hotel · Flight"), observed 2026-11-15:
 *  1. Hotel step: hotel results with context=holidays (same page object as Hotels).
 *  2. "View Deal" opens hotel details in a NEW TAB; "Reserve" calls POST /api/hotels/Select2.
 *  3. Flight step in that tab: round-trip flight results with context=holidays.
 *  4. "Book Now" -> /cart?context=holidays with both the hotel and the flight in the booking summary.
 */
export class PackageBuilderPage extends BasePage {
  readonly hotelResults = new HotelResultsPage(this.page);

  get stepper(): Locator {
    return this.main.getByText(/Building your holiday/);
  }

  /** Step 1-2: open the first hotel's details tab. */
  async openHotel(index = 0): Promise<{ listing: HotelCardSummary; tab: Page }> {
    await this.hotelResults.waitForOutcome();
    const card = this.hotelResults.cards.nth(index);
    const listing = await this.hotelResults.summaryOf(card);
    const tab = await this.hotelResults.openDeal(card);
    return { listing, tab };
  }

  /**
   * Reserve the first room in the details tab; resolves with the flight-step page object.
   * A failed POST /api/hotels/Select2 is surfaced as an application error (seen intermittently as HTTP 500).
   */
  static async reserveRoom(tab: Page): Promise<{ room: RoomSummary; flights: FlightResultsPage }> {
    const details = new HotelDetailsPage(tab);
    await details.waitForLoaded();
    const roomCard = details.rooms.first();
    const room = await details.roomSummary(roomCard);
    const select = tab.waitForResponse((r) => /\/api\/hotels\/Select/i.test(r.url()) && r.request().method() === 'POST', { timeout: 60_000 }).catch(() => null);
    await details.reserve(roomCard);
    const res = await select;
    if (res && res.status() >= 400) {
      throw new Error(`Package room reservation failed: POST ${new URL(res.url()).pathname} returned HTTP ${res.status()} for room "${room.name}".`);
    }
    await expect(tab).toHaveURL(/\/flights\/results\/.*context=holidays/, { timeout: timeouts.flightResults });
    return { room, flights: new FlightResultsPage(tab) };
  }

  /**
   * Step 4: book a package flight and land on the package cart. Owner rule (2026-11-22): a flight that cannot be
   * selected is recorded (annotation + screenshot) and the next flight on the listing is tried (up to 5),
   * tracked by card label because the listing can re-order after the reload.
   */
  static async bookFlight(flights: FlightResultsPage): Promise<{ flight: FlightCardSummary; cart: CartPage }> {
    const outcome = await flights.waitForOutcome();
    if (outcome.kind === 'empty') throw new Error(`No package flights offered: ${outcome.message.slice(0, 200)}`);
    const page = flights.page;
    const resultsUrl = page.url();
    const tried = new Set<string>();
    const failures: string[] = [];
    while (tried.size < 5) {
      const count = await flights.cards.count();
      let index = -1;
      for (let i = 0; i < count && index < 0; i += 1) {
        const l = (await flights.card(i).getAttribute('aria-label')) ?? `card ${i}`;
        if (!tried.has(l)) { index = i; tried.add(l); }
      }
      if (index < 0) break;
      const card = flights.card(index);
      const flight = await flights.summaryOf(card);
      try {
        await card.getByRole('button', { name: FLIGHT_BOOK_CTA }).click();
        const cart = new CartPage(page);
        await expect(page).toHaveURL(/\/cart\?context=holidays/, { timeout: timeouts.cart });
        await cart.waitForReady();
        return { flight, cart };
      } catch (error) {
        const message = `${flight.airline} ₦${flight.price}: ${(error as Error).message.split('\n')[0]}`;
        failures.push(message);
        const info = test.info();
        info.annotations.push({ type: 'flight-selection-failure', description: `Package flight ${message} → moving to the next flight` });
        const shot = await page.screenshot().catch(() => undefined);
        if (shot) await info.attach(`package-flight-selection-failure-${failures.length}.png`, { body: shot, contentType: 'image/png' });
        await page.goto(resultsUrl, { waitUntil: 'domcontentloaded' });
        await flights.waitForOutcome();
      }
    }
    throw new Error(`No package flight could be selected. Failures: ${failures.join(' | ')}`);
  }
}
