import type { Page, Response } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { CartPage } from '../common/CartPage';
import { HotelDetailsPage, type RoomSummary } from './HotelDetailsPage';

/**
 * Room reservation hand-off from the hotel details tab to the shared checkout (/cart).
 * Operates on the details tab's Page because hotel details open in a new tab.
 * "Reserve" calls POST /api/hotels/Select2; a failed call is surfaced with its HTTP status
 * so an application failure is not mistaken for a locator problem.
 */
export class HotelBookingPage extends BasePage {
  readonly details: HotelDetailsPage;
  readonly cart: CartPage;

  constructor(page: Page) {
    super(page);
    this.details = new HotelDetailsPage(page);
    this.cart = new CartPage(page);
  }

  async reserveFirstRoom(): Promise<{ room: RoomSummary; cart: CartPage }> {
    const room = this.details.rooms.first();
    const summary = await this.details.roomSummary(room);
    const selectCall = this.page
      .waitForResponse((r) => /\/api\/hotels\/Select/i.test(r.url()) && r.request().method() === 'POST', { timeout: 60_000 })
      .catch(() => null);
    await this.details.reserve(room);
    const response: Response | null = await selectCall;
    if (response && response.status() >= 400) {
      throw new Error(
        `Room reservation failed: POST ${new URL(response.url()).pathname} returned HTTP ${response.status()} ` +
          `for room "${summary.name}"; the page stayed on hotel details without a user-facing error.`,
      );
    }
    await this.cart.waitForReady();
    return { room: summary, cart: this.cart };
  }
}
