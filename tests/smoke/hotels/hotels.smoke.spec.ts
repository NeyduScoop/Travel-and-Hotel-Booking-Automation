import { test, expect, Tag } from '../../../fixtures/test.fixture';
import { DataFactory } from '../../../utils/data.factory';
import { displayDate } from '../../../utils/date.utils';
import { timeouts } from '../../../config/test.config';

test.describe('Hotels smoke', { tag: [Tag.smoke, Tag.hotels] }, () => {
  test.beforeEach(async ({ hotelSearch }) => {
    await hotelSearch.openSearch();
  });

  test('hotel module loads with the search widget', { tag: [Tag.critical, Tag.positive] }, async ({ hotelSearch }) => {
    await expect(hotelSearch.destination.input).toBeEditable();
    await expect(hotelSearch.dates.field('Check-in')).toBeVisible();
    await expect(hotelSearch.dates.field('Check-out')).toBeVisible();
    await expect(hotelSearch.guests.trigger).toHaveText(/Adults?, \d+ Rooms?/);
    await expect(hotelSearch.searchButton).toBeEnabled();
  });

  test('configured destination can be selected from the autocomplete', { tag: [Tag.positive] }, async ({ hotelSearch }) => {
    const c = DataFactory.hotelSearch();
    const value = await hotelSearch.selectDestination(c.destination, c.destinationOption);
    expect(value).toMatch(new RegExp(c.destination, 'i'));
  });

  test('check-in/check-out dates and guest/room configuration apply', { tag: [Tag.positive] }, async ({ hotelSearch }) => {
    const c = DataFactory.hotelSearch();
    await hotelSearch.dates.selectRange('Check-in', c.checkIn, 'Check-out', c.checkOut);
    expect(await hotelSearch.dates.values()).toEqual([displayDate(c.checkIn), displayDate(c.checkOut)]);
    await hotelSearch.setGuests(c.guests, c.rooms);
    await expect(hotelSearch.guests.trigger).toHaveText('1 Adult, 1 Child, 1 Room');
  });

  test('search runs and shows hotels or a valid empty state', { tag: [Tag.critical, Tag.positive] }, async ({ hotelSearch, hotelResults, observe }) => {
    test.setTimeout(timeouts.bookingFlow);
    const c = DataFactory.hotelSearch();
    await hotelSearch.fill(c);
    const started = Date.now();
    await hotelSearch.searchButton.click();
    const outcome = await hotelResults.waitForOutcome();
    observe(`Hotel search ${c.destination}: ${outcome.kind} in ${Date.now() - started} ms`);
    if (outcome.kind === 'results') {
      const first = await hotelResults.summaryOf(hotelResults.cards.first());
      expect(first.name.length).toBeGreaterThan(0);
      expect(first.totalPrice).toBeGreaterThan(0);
      expect(first.nights).toBe(3);
    } else {
      expect(outcome.message).toMatch(/no (hotels|properties|results)|0 hotels|try/i);
    }
  });
});
