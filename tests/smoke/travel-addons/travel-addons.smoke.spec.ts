import { test, expect, Tag } from '../../../fixtures/test.fixture';
import { addonDeparture } from '../../../data/travel-addons/addons.data';
import { dateOffsets } from '../../../config/test.config';
import { futureDate } from '../../../utils/date.utils';

test.describe('Travel Add-ons smoke', { tag: [Tag.smoke, Tag.addons] }, () => {
  test('Travel Add-ons is reachable from the homepage sub-header tab', { tag: [Tag.critical, Tag.positive] }, async ({ navigation, travelAddons }) => {
    await navigation.openHome();
    await navigation.productTab('Travel Add-ons').click();
    await expect(navigation.productTab('Travel Add-ons')).toHaveAttribute('aria-selected', 'true');
    await expect(navigation.main.getByRole('button', { name: 'Search extras' })).toBeVisible();
    await travelAddons.openAddons();
    await expect(travelAddons.emptyPrompt).toBeVisible();
    await expect(travelAddons.searchButton).toBeEnabled();
  });

  test('searching the configured departure lists available add-ons', { tag: [Tag.critical, Tag.positive] }, async ({ travelAddons, observe }) => {
    await travelAddons.openAddons();
    const started = Date.now();
    await travelAddons.search(addonDeparture.code, addonDeparture.searchText, futureDate(dateOffsets.addonDepartureDays));
    const outcome = await travelAddons.waitForOutcome();
    observe(`Add-on search ${addonDeparture.code}: ${outcome.kind} in ${Date.now() - started} ms`);
    expect(outcome.kind).toBe('results');
    const first = await travelAddons.summaryOf(travelAddons.cards.first());
    expect(first.unitPrice).toBeGreaterThan(0);
  });

  test('an add-on can be selected into the selection panel', { tag: [Tag.positive] }, async ({ travelAddons, addonSelection }) => {
    await travelAddons.openAddons();
    await travelAddons.search(addonDeparture.code, addonDeparture.searchText, futureDate(dateOffsets.addonDepartureDays));
    await travelAddons.waitForOutcome();
    await expect(addonSelection.emptyHeading).toBeVisible();
    const first = await travelAddons.summaryOf(travelAddons.cards.first());
    await travelAddons.add(travelAddons.card(first.name));
    await expect(addonSelection.selectionsHeading).toBeVisible();
    await addonSelection.expectItemCount(1);
    await expect(addonSelection.items.first()).toContainText(first.name);
    await expect(addonSelection.continueToCart).toBeEnabled();
  });
});
