import { test, expect, Tag } from '../../../fixtures/test.fixture';
import { DataFactory } from '../../../utils/data.factory';
import { expectAmountClose, expectAscending, expectDescending } from '../../../utils/assertions';
import { timeouts } from '../../../config/test.config';
import type { HotelSearchPage } from '../../../pages/hotels/HotelSearchPage';
import type { HotelResultsPage } from '../../../pages/hotels/HotelResultsPage';
import { hotelDestinationsInPriority } from '../../../data/hotels/hotel.data';

/** Umrah rules (REG-001/013/023) apply to Makkah, so these tests use the configured Makkah destination wherever it sits in the priority list. */
const MAKKAH = hotelDestinationsInPriority.find((d) => /^Makkah\b/i.test(d));

async function searchMakkah(hotelSearch: HotelSearchPage, hotelResults: HotelResultsPage, blocked: (r: string) => never) {
  if (!MAKKAH) blocked('TEST DATA ISSUE: no Makkah destination is configured in hotel.destination (primary or fallback).');
  await hotelSearch.openSearch();
  await hotelSearch.search(DataFactory.hotelSearch({ destination: MAKKAH!.split(',')[0].trim(), destinationOption: MAKKAH! }));
  const outcome = await hotelResults.waitForOutcome();
  if (outcome.kind === 'empty') blocked('MISSING INVENTORY: no Makkah hotel inventory on this environment.');
}

test.describe('Hotels regression – results, Umrah rules, sorting, filters', { tag: [Tag.regression, Tag.hotels] }, () => {
  test.describe.configure({ timeout: timeouts.bookingFlow });

  test('REG-001: Umrah hotels are listed with a distinct Umrah badge', { tag: [Tag.critical, Tag.positive] }, async ({ hotelSearch, hotelResults, blocked }) => {
    await searchMakkah(hotelSearch, hotelResults, blocked);
    const umrah = (await hotelResults.summaries()).filter((h) => h.umrahApproved);
    expect(umrah.length, 'Makkah search should return Umrah Approved properties').toBeGreaterThan(0);
  });

  test('REG-013 / REG-023: Umrah properties are prioritised before other properties', { tag: [Tag.critical, Tag.positive] }, async ({ hotelSearch, hotelResults, blocked }) => {
    await searchMakkah(hotelSearch, hotelResults, blocked);
    const flags = (await hotelResults.summaries()).map((h) => h.umrahApproved);
    const firstNonUmrah = flags.indexOf(false);
    const umrahAfterNonUmrah = firstNonUmrah >= 0 && flags.slice(firstNonUmrah).includes(true);
    expect(umrahAfterNonUmrah, `Umrah flags in listing order: ${flags.join(',')}`).toBe(false);
  });

  test('listing per-night price equals total / nights', { tag: [Tag.positive] }, async ({ hotelSearch, hotelResults, blocked }) => {
    await searchMakkah(hotelSearch, hotelResults, blocked);
    for (const h of await hotelResults.summaries()) {
      expect(h.nights).toBe(3);
      expectAmountClose(h.perNightPrice, h.totalPrice / h.nights, `per-night price for ${h.name}`);
    }
  });

  test('"Showing X of Y" is consistent with the cards rendered', { tag: [Tag.negative] }, async ({ hotelSearch, hotelResults, blocked }) => {
    await searchMakkah(hotelSearch, hotelResults, blocked);
    const { shown, total } = await hotelResults.showing();
    expect(await hotelResults.cards.count()).toBe(shown);
    if (await hotelResults.endOfResults.isVisible()) {
      expect(shown, 'at the end of results every hotel counted in the total should be shown').toBe(total);
    }
  });

  test('"Price ↑" sorts totals ascending', { tag: [Tag.positive] }, async ({ hotelSearch, hotelResults, blocked }) => {
    await searchMakkah(hotelSearch, hotelResults, blocked);
    await hotelResults.sort.choose('Price ↑');
    await expect.poll(async () => {
      const t = (await hotelResults.summaries()).map((h) => h.totalPrice);
      return t.every((v, i) => i === 0 || t[i - 1] <= v);
    }, { timeout: 20_000 }).toBe(true);
    expectAscending((await hotelResults.summaries()).map((h) => h.totalPrice), 'hotel totals');
  });

  test('"Price ↓" sorts totals descending', { tag: [Tag.positive] }, async ({ hotelSearch, hotelResults, blocked }) => {
    await searchMakkah(hotelSearch, hotelResults, blocked);
    await hotelResults.sort.choose('Price ↓');
    await expect.poll(async () => {
      const t = (await hotelResults.summaries()).map((h) => h.totalPrice);
      return t.every((v, i) => i === 0 || t[i - 1] >= v);
    }, { timeout: 20_000 }).toBe(true);
    expectDescending((await hotelResults.summaries()).map((h) => h.totalPrice), 'hotel totals');
  });

  test('hotel name filter narrows results to matching properties', { tag: [Tag.positive] }, async ({ hotelSearch, hotelResults, blocked }) => {
    await searchMakkah(hotelSearch, hotelResults, blocked);
    const target = (await hotelResults.summaryOf(hotelResults.cards.first())).name;
    const term = target.split(' ')[0];
    await hotelResults.nameFilter.fill(term);
    await expect.poll(async () => (await hotelResults.summaries()).every((h) => h.name.toLowerCase().includes(term.toLowerCase())), { timeout: 20_000 }).toBe(true);
    expect(await hotelResults.cards.count()).toBeGreaterThan(0);
  });

  test('a non-matching hotel name filter shows no cards', { tag: [Tag.negative] }, async ({ hotelSearch, hotelResults, blocked }) => {
    await searchMakkah(hotelSearch, hotelResults, blocked);
    await hotelResults.nameFilter.fill('zzzz-no-such-hotel');
    await expect(hotelResults.cards).toHaveCount(0, { timeout: 20_000 });
  });
});
