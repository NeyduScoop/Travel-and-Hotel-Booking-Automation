import { test, expect, Tag } from '../../../fixtures/test.fixture';
import { DataFactory } from '../../../utils/data.factory';
import { tourCategories } from '../../../data/tours/tour.data';
import { timeouts } from '../../../config/test.config';

test.describe('Tours smoke', { tag: [Tag.smoke, Tag.tours] }, () => {
  test('tours module loads; destination is gated by country', { tag: [Tag.critical, Tag.positive] }, async ({ tourSearch }) => {
    await tourSearch.openSearch();
    await expect(tourSearch.country.input).toBeEditable();
    await expect(tourSearch.destination.input).toBeDisabled();
    await expect(tourSearch.searchButton).toBeVisible();
    await tourSearch.selectCountry(DataFactory.tourSearch().country);
    await expect(tourSearch.destination.input).toBeEnabled();
  });

  test('tour search returns experiences with category filters available', { tag: [Tag.critical, Tag.positive] }, async ({ tourSearch, tourResults, observe }) => {
    test.setTimeout(timeouts.bookingFlow);
    const c = DataFactory.tourSearch();
    await tourSearch.openSearch();
    await tourSearch.fill(c);
    const started = Date.now();
    await tourSearch.searchButton.click();
    const outcome = await tourResults.waitForOutcome();
    observe(`Tour search ${c.destination}: ${outcome.kind} in ${Date.now() - started} ms`);
    expect(outcome.kind, 'configured destination should have tour inventory on DEVTEST').toBe('results');
    await expect(tourResults.heading).toHaveText(new RegExp(`${c.destination} Tours`, 'i'));
    for (const category of tourCategories) await expect(tourResults.filters.radio(category)).toBeVisible();
  });

  test('a tour can be selected and its options are shown', { tag: [Tag.positive] }, async ({ tourSearch, tourResults, tourDetails }) => {
    test.setTimeout(timeouts.bookingFlow);
    await tourSearch.openSearch();
    await tourSearch.search(DataFactory.tourSearch());
    const outcome = await tourResults.waitForOutcome();
    expect(outcome.kind).toBe('results');
    const card = tourResults.cards.first();
    const { title } = await tourResults.summaryOf(card);
    await tourResults.openDetails(card);
    await tourDetails.waitForLoaded();
    await expect(tourDetails.heading).toHaveText(title);
    await expect(tourDetails.optionRadios.first()).toBeVisible();
    // Some tours (e.g. Cairo) also repeat the options as a "Select Tour Option" sidebar select; others
    // (London, 2026-11-16) offer only the radiogroup. Choosing an option must make the tour bookable.
    await tourDetails.ensureOptionSelected();
    await expect(tourDetails.bookNowButton).toBeEnabled({ timeout: 20_000 });
  });
});
