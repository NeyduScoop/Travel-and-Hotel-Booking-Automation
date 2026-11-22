import { test, expect, Tag } from '../../../fixtures/test.fixture';
import { DataFactory } from '../../../utils/data.factory';
import { expectAscending, expectDescending } from '../../../utils/assertions';
import { timeouts } from '../../../config/test.config';
import type { TourSearchPage } from '../../../pages/tours/TourSearchPage';
import type { TourResultsPage } from '../../../pages/tours/TourResultsPage';

async function searchTours(tourSearch: TourSearchPage, tourResults: TourResultsPage, blocked: (r: string) => never) {
  const criteria = DataFactory.tourSearch();
  await tourSearch.openSearch();
  await tourSearch.search(criteria);
  const outcome = await tourResults.waitForOutcome();
  if (outcome.kind === 'empty') blocked(`No tour inventory for ${criteria.destination} on this environment.`);
  return criteria;
}

test.describe('Tours regression', { tag: [Tag.regression, Tag.tours] }, () => {
  test.describe.configure({ timeout: timeouts.bookingFlow });

  test('search without country/destination does not run', { tag: [Tag.negative] }, async ({ tourSearch }) => {
    await tourSearch.openSearch();
    await tourSearch.searchButton.click();
    await expect(tourSearch.page).toHaveURL(/\/tours\/?$/);
    await expect(tourSearch.destination.input).toBeDisabled();
  });

  test('destination list is scoped to the selected country', { tag: [Tag.positive] }, async ({ tourSearch }) => {
    const c = DataFactory.tourSearch();
    await tourSearch.openSearch();
    await tourSearch.selectCountry(c.country);
    // search() retries through hydration and waits for suggestions to appear.
    await tourSearch.destination.search(c.destination);
    const suggestions = await tourSearch.destination.options.allInnerTexts();
    expect(suggestions.some((s) => new RegExp(c.destination, 'i').test(s))).toBe(true);
  });

  test('results heading, count and URL reflect the search', { tag: [Tag.critical, Tag.positive] }, async ({ tourSearch, tourResults, blocked }) => {
    const c = await searchTours(tourSearch, tourResults, blocked);
    await expect(tourResults.page).toHaveURL(new RegExp(`destination=${c.destination}.*adults=${c.adults}`, 'i'));
    await expect(tourResults.heading).toHaveText(new RegExp(`^\\s*${c.destination} Tours & Experiences\\s*$`, 'i'));
    expect(await tourResults.experiencesFound()).toBeGreaterThanOrEqual(await tourResults.cards.count());
  });

  test('category filter narrows the result set', { tag: [Tag.positive] }, async ({ tourSearch, tourResults, blocked }) => {
    await searchTours(tourSearch, tourResults, blocked);
    const before = await tourResults.experiencesFound();
    await tourResults.filterByCategory('City Tours');
    await expect.poll(() => tourResults.experiencesFound(), { timeout: 20_000 }).toBeLessThanOrEqual(before);
    expect(await tourResults.cards.count()).toBeGreaterThan(0);
  });

  test('price (low–high) sort orders "From" prices ascending', { tag: [Tag.positive] }, async ({ tourSearch, tourResults, blocked }) => {
    await searchTours(tourSearch, tourResults, blocked);
    await tourResults.sort.choose('Price (low–high)');
    await expect.poll(async () => {
      const p = (await tourResults.summaries()).map((s) => s.fromPricePerAdult);
      return p.every((v, i) => i === 0 || p[i - 1] <= v);
    }, { timeout: 20_000 }).toBe(true);
    expectAscending((await tourResults.summaries()).map((s) => s.fromPricePerAdult), 'tour From prices');
  });

  test('price (high–low) sort orders "From" prices descending', { tag: [Tag.positive] }, async ({ tourSearch, tourResults, blocked }) => {
    await searchTours(tourSearch, tourResults, blocked);
    await tourResults.sort.choose('Price (high–low)');
    await expect.poll(async () => {
      const p = (await tourResults.summaries()).map((s) => s.fromPricePerAdult);
      return p.every((v, i) => i === 0 || p[i - 1] >= v);
    }, { timeout: 20_000 }).toBe(true);
    expectDescending((await tourResults.summaries()).map((s) => s.fromPricePerAdult), 'tour From prices');
  });

  test('tour details keep the selected tour, travellers and availability options', { tag: [Tag.critical, Tag.positive] }, async ({ tourSearch, tourResults, tourDetails, blocked }) => {
    const c = await searchTours(tourSearch, tourResults, blocked);
    const card = tourResults.cards.first();
    const { title } = await tourResults.summaryOf(card);
    await tourResults.openDetails(card);
    await tourDetails.waitForLoaded();
    await expect(tourDetails.heading).toHaveText(title);
    expect(await tourDetails.travellersCount()).toBe(c.adults);
    expect(await tourDetails.optionRadios.count()).toBeGreaterThan(0);
    await expect(tourDetails.region('Cancellation policy')).toBeVisible();
  });

  test('tour total equals per-adult price × travellers', { tag: [Tag.critical, Tag.positive] }, async ({ tourSearch, tourResults, tourDetails, blocked }) => {
    const c = await searchTours(tourSearch, tourResults, blocked);
    await tourResults.openDetails(tourResults.cards.first());
    await tourDetails.waitForLoaded();
    const perAdult = await tourDetails.fromPricePerAdult();
    expect(await tourDetails.summary.total()).toBe(perAdult * c.adults);
  });

  test('Book now is enabled once a tour option is selected', { tag: [Tag.critical, Tag.positive] }, async ({ tourSearch, tourResults, tourDetails, observe, blocked }) => {
    await searchTours(tourSearch, tourResults, blocked);
    await tourResults.openDetails(tourResults.cards.first());
    await tourDetails.waitForLoaded();
    const option = await tourDetails.ensureOptionSelected();
    observe(`Tour option in effect: ${option}`);
    await expect(tourDetails.bookNowButton).toBeEnabled({ timeout: 20_000 });
  });
});
