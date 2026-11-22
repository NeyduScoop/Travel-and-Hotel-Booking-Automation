import { expect, type Locator } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { timeouts } from '../../config/test.config';
import { parseNaira } from '../../utils/assertions';

export interface RoomSummary {
  name: string;
  total: number;
  perNight: number;
  /** PRIME member price on the room card (signed-in PRIME sessions only). */
  primePrice?: number;
}

/** Hotel details page (/hotels/<encoded-id>?…), opened in a new tab from the listing. */
export class HotelDetailsPage extends BasePage {
  get heading(): Locator {
    return this.main.getByRole('heading', { level: 1 });
  }
  get breadcrumb(): Locator {
    return this.main.getByRole('navigation', { name: 'Breadcrumb' });
  }
  tab(name: 'Overview' | 'About' | 'Rooms' | 'Policies'): Locator {
    return this.main.getByRole('tab', { name, exact: true });
  }
  get selectRoomButton(): Locator {
    return this.main.getByRole('button', { name: 'Select a room' });
  }
  get chooseRoomHeading(): Locator {
    return this.main.getByRole('heading', { name: 'Choose your room', level: 3 });
  }
  get roomsShown(): Locator {
    return this.main.getByText(/\d+ of \d+ rooms? shown/);
  }
  get rooms(): Locator {
    return this.main.getByRole('article').filter({ has: this.page.getByRole('heading', { level: 4 }) }).filter({
      has: this.page.getByRole('button', { name: 'Reserve' }),
    });
  }
  get policiesHeading(): Locator {
    return this.main.getByRole('heading', { name: 'Policies', level: 3 });
  }
  /** Policy value (<dd>) for a term (<dt>) such as "Check-in". */
  policyDefinition(term: 'Check-in' | 'Check-out'): Locator {
    return this.main.locator(`xpath=.//dt[normalize-space()="${term}"]/following-sibling::dd[1]`);
  }

  /** Visible text fragments that look like un-rendered HTML markup (e.g. "<ul> <li>"). */
  async rawHtmlFragments(): Promise<string[]> {
    const text = await this.main.innerText();
    return [...text.matchAll(/<\/?(?:ul|li|p|br|div|span|b|strong)\s*\/?>/gi)].map((m) => m[0]);
  }

  /** Room details must load within 70 s, otherwise it is a defect (Project.md §11). */
  async waitForLoaded(timeout: number = timeouts.hotelDetails): Promise<number> {
    const start = Date.now();
    await expect(this.heading).toBeVisible({ timeout });
    await expect(this.rooms.first()).toBeVisible({ timeout: Math.max(1_000, timeout - (Date.now() - start)) });
    return Date.now() - start;
  }

  /**
   * Room prices. The first amount in the card is the selected rate's full total (guests and members).
   * Signed-in PRIME members additionally see "₦X Prime" (observed 2026-11-15: the bold <strong> is then
   * the PRIME price, so the full total is not read from <strong>).
   */
  async roomSummary(room: Locator): Promise<RoomSummary> {
    const name = (await room.getByRole('heading', { level: 4 }).innerText()).trim();
    const text = (await room.innerText()).replace(/\s+/g, ' ');
    const first = /₦[\d,]+/.exec(text);
    if (!first) throw new Error(`No price in room "${name}"`);
    const perNightMatch = /(₦[\d,]+)\s*\/\s*night/.exec(text);
    if (!perNightMatch) throw new Error(`No per-night price in room "${name}"`);
    const prime = /(₦[\d,]+)\s*Prime\b/i.exec(text);
    return { name, total: parseNaira(first[0]), perNight: parseNaira(perNightMatch[1]), primePrice: prime ? parseNaira(prime[1]) : undefined };
  }

  async reserve(room: Locator): Promise<void> {
    await room.getByRole('button', { name: 'Reserve' }).click();
  }
}
