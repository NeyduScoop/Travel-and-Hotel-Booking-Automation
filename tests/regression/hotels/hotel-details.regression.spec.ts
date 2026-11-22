import { test, expect, Tag } from '../../../fixtures/test.fixture';
import { DataFactory } from '../../../utils/data.factory';
import { HotelDetailsPage } from '../../../pages/hotels/HotelDetailsPage';
import { HotelBookingPage } from '../../../pages/hotels/HotelBookingPage';
import { expectAmountClose } from '../../../utils/assertions';
import { nightsBetween, shortMonth } from '../../../utils/date.utils';
import { timeouts } from '../../../config/test.config';
import { passengerData, primaryContact } from '../../../data/common/passengers.data';
import type { HotelSearchPage } from '../../../pages/hotels/HotelSearchPage';
import type { HotelResultsPage } from '../../../pages/hotels/HotelResultsPage';

/** Search, open the first hotel in its new tab and return the details page plus listing data. */
async function openFirstHotel(hotelSearch: HotelSearchPage, hotelResults: HotelResultsPage, blocked: (r: string) => never) {
  const criteria = DataFactory.hotelSearch();
  await hotelSearch.openSearch();
  await hotelSearch.search(criteria);
  const outcome = await hotelResults.waitForOutcome();
  if (outcome.kind === 'empty') blocked('No hotel inventory for the primary destination on this environment.');
  const card = hotelResults.cards.first();
  const listing = await hotelResults.summaryOf(card);
  const tab = await hotelResults.openDeal(card);
  const details = new HotelDetailsPage(tab);
  const loadMs = await details.waitForLoaded();
  return { criteria, listing, tab, details, loadMs };
}

test.describe('Hotels regression – details, rooms, pricing, booking hand-off', { tag: [Tag.regression, Tag.hotels] }, () => {
  test.describe.configure({ timeout: timeouts.bookingFlow });

  test('View Deal opens hotel details in a new tab within 70 s', { tag: [Tag.critical, Tag.positive] }, async ({ hotelSearch, hotelResults, page, observe, blocked }) => {
    const { listing, tab, details, loadMs } = await openFirstHotel(hotelSearch, hotelResults, blocked);
    observe(`Hotel details load time: ${loadMs} ms`);
    expect(tab).not.toBe(page);
    expect(loadMs).toBeLessThan(timeouts.hotelDetails);
    await expect(details.heading).toHaveText(new RegExp(listing.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    await expect(details.chooseRoomHeading).toBeVisible();
    expect(await details.rooms.count()).toBeGreaterThan(0);
  });

  test('policies show the searched check-in and check-out dates', { tag: [Tag.positive] }, async ({ hotelSearch, hotelResults, blocked }) => {
    const { criteria, details } = await openFirstHotel(hotelSearch, hotelResults, blocked);
    const fmt = (d: Date) => `${shortMonth(d)} ${d.getDate()}, ${d.getFullYear()}`;
    await expect(details.policyDefinition('Check-in')).toContainText(fmt(criteria.checkIn));
    await expect(details.policyDefinition('Check-out')).toContainText(fmt(criteria.checkOut));
  });

  test('room per-night price equals room total / nights', { tag: [Tag.critical, Tag.negative] }, async ({ hotelSearch, hotelResults, blocked }) => {
    const { criteria, details } = await openFirstHotel(hotelSearch, hotelResults, blocked);
    const nights = nightsBetween(criteria.checkIn, criteria.checkOut);
    for (const room of await details.rooms.all()) {
      const r = await details.roomSummary(room);
      expectAmountClose(r.perNight, r.total / nights, `per-night price for room "${r.name}"`);
    }
  });

  test('listing price matches the lowest room total on the details page', { tag: [Tag.positive] }, async ({ hotelSearch, hotelResults, blocked }) => {
    const { listing, details } = await openFirstHotel(hotelSearch, hotelResults, blocked);
    const totals = await Promise.all((await details.rooms.all()).map(async (r) => (await details.roomSummary(r)).total));
    expect(Math.min(...totals)).toBe(listing.totalPrice);
  });

  test('policy content is rendered without raw HTML markup', { tag: [Tag.negative] }, async ({ hotelSearch, hotelResults, blocked }) => {
    const { details } = await openFirstHotel(hotelSearch, hotelResults, blocked);
    expect(await details.rawHtmlFragments()).toEqual([]);
  });

  test('reserving a room carries the room total into the cart', { tag: [Tag.critical, Tag.positive] }, async ({ hotelSearch, hotelResults, requireCartCreation, blocked }) => {
    void requireCartCreation;
    const { tab } = await openFirstHotel(hotelSearch, hotelResults, blocked);
    const booking = new HotelBookingPage(tab);
    const { room, cart } = await booking.reserveFirstRoom();
    // Compare once the line items have loaded (the panel first shows a bare "Total"; observed 2026-11-22).
    const breakdown = await cart.priceBreakdown.readWithLines();
    const addons = breakdown.addons.reduce((s, a) => s + a.amount, 0);
    expect(breakdown.grandTotal - addons, `cart total (excluding ₦${addons} add-ons) = room total: ${breakdown.text.slice(0, 250)}`).toBe(room.total);
    await expect(cart.proceedToPay).toBeDisabled();
  });

  test('guest information with canonical data enables payment (not submitted)', { tag: [Tag.positive] }, async ({ hotelSearch, hotelResults, requireCartCreation, blocked }) => {
    void requireCartCreation;
    const { tab, criteria } = await openFirstHotel(hotelSearch, hotelResults, blocked);
    const { cart } = await new HotelBookingPage(tab).reserveFirstRoom();
    await cart.fillContact(primaryContact);
    // One guest block per searched guest: canonical adults first, then canonical children.
    const guests = [
      ...passengerData.adults.slice(0, criteria.guests.adults),
      ...passengerData.children.slice(0, criteria.guests.children),
    ];
    await expect(cart.main.getByRole('textbox', { name: 'Surname', exact: true }), 'one guest block per searched guest').toHaveCount(guests.length);
    await cart.fillTravellers(guests);
    await cart.acceptTerms();
    await expect(cart.proceedToPay).toBeEnabled({ timeout: 30_000 });
  });
});
