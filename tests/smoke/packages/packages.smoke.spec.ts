import { test, expect, Tag } from '../../../fixtures/test.fixture';
import { DataFactory } from '../../../utils/data.factory';
import { packageData } from '../../../data/packages/package.data';
import { displayDate } from '../../../utils/date.utils';
import { timeouts } from '../../../config/test.config';

test.describe('Packages smoke', { tag: [Tag.smoke, Tag.packages] }, () => {
  test('packages module loads from the header with the search widget', { tag: [Tag.critical, Tag.positive] }, async ({ navigation, packageSearch }) => {
    await navigation.openHome();
    await navigation.navigateTo('Packages');
    await expect(packageSearch.heading).toBeVisible();
    await expect(packageSearch.from.input).toBeEditable();
    await expect(packageSearch.destination.input).toBeEditable();
    await expect(packageSearch.dates.field('Departure')).toBeVisible();
    await expect(packageSearch.dates.field('Return')).toBeVisible();
    await expect(packageSearch.travellers.trigger).toHaveText(`${packageData.travellers} Adults`);
    await expect(packageSearch.buildButton).toBeEnabled();
  });

  test('configured departure, primary destination, dates and travellers can be entered', { tag: [Tag.positive] }, async ({ packageSearch }) => {
    const c = DataFactory.packageSearch();
    await packageSearch.openSearch();
    await packageSearch.fill(c);
    await expect(packageSearch.from.input).toHaveValue(new RegExp(`^${c.departure.code} - `));
    await expect(packageSearch.destination.input).toHaveValue(new RegExp(c.destination, 'i'));
    expect(await packageSearch.dates.values()).toEqual([displayDate(c.departureDate), displayDate(c.returnDate)]);
  });

  test('building a package opens the hotel step with hotels or a valid empty state', { tag: [Tag.critical, Tag.positive] }, async ({ packageSearch, packageBuilder, observe }) => {
    test.setTimeout(timeouts.bookingFlow);
    const c = DataFactory.packageSearch();
    await packageSearch.openSearch();
    await packageSearch.fill(c);
    const started = Date.now();
    await packageSearch.build();
    const outcome = await packageBuilder.hotelResults.waitForOutcome();
    observe(`Package hotel step for ${c.destination}: ${outcome.kind} in ${Date.now() - started} ms`);
    await expect(packageBuilder.page).toHaveURL(/context=holidays/);
    if (outcome.kind === 'results') expect((await packageBuilder.hotelResults.summaryOf(packageBuilder.hotelResults.cards.first())).totalPrice).toBeGreaterThan(0);
  });
});
