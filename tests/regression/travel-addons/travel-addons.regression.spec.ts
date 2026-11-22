import { test, expect, Tag } from '../../../fixtures/test.fixture';
import { addonData, addonDeparture } from '../../../data/travel-addons/addons.data';
import { primaryContact, leadAdult } from '../../../data/common/passengers.data';
import { dateOffsets, timeouts } from '../../../config/test.config';
import { futureDate, isoDate } from '../../../utils/date.utils';
import type { TravelAddonsPage } from '../../../pages/travel-addons/TravelAddonsPage';
import type { AddonCardSummary } from '../../../types/addon.types';

async function searchAddons(travelAddons: TravelAddonsPage, blocked: (r: string) => never): Promise<void> {
  await travelAddons.openAddons();
  await travelAddons.search(addonDeparture.code, addonDeparture.searchText, futureDate(dateOffsets.addonDepartureDays));
  const outcome = await travelAddons.waitForOutcome();
  if (outcome.kind === 'empty') blocked(`No add-ons offered for ${addonDeparture.code} on this environment.`);
}

/** Add the first two listed add-ons (Project.md §14 selection rule) and return them. */
async function addFirstTwo(travelAddons: TravelAddonsPage): Promise<AddonCardSummary[]> {
  const picked = [await travelAddons.summaryOf(travelAddons.cards.nth(0)), await travelAddons.summaryOf(travelAddons.cards.nth(1))];
  for (const item of picked) await travelAddons.add(travelAddons.card(item.name));
  return picked;
}

test.describe('Travel Add-ons regression', { tag: [Tag.regression, Tag.addons] }, () => {
  test.describe.configure({ timeout: timeouts.bookingFlow });

  test('search without a departure airport shows no add-ons', { tag: [Tag.negative] }, async ({ travelAddons }) => {
    await travelAddons.openAddons();
    await travelAddons.searchButton.click();
    await expect(travelAddons.emptyPrompt).toBeVisible();
    await expect(travelAddons.cards).toHaveCount(0);
  });

  test('search URL and heading reflect the departure and date', { tag: [Tag.positive] }, async ({ travelAddons, blocked }) => {
    await searchAddons(travelAddons, blocked);
    const date = isoDate(futureDate(dateOffsets.addonDepartureDays));
    await expect(travelAddons.page).toHaveURL(new RegExp(`origin=${addonData.from}.*departureDate=${date}`));
    await expect(travelAddons.resultsHeading).toContainText(/lagos/i);
  });

  test('every listed add-on shows a positive adult price', { tag: [Tag.positive] }, async ({ travelAddons, blocked }) => {
    await searchAddons(travelAddons, blocked);
    for (const card of await travelAddons.cards.all()) expect((await travelAddons.summaryOf(card)).unitPrice).toBeGreaterThan(0);
  });

  test('two add-ons appear in the selection with a correct total', { tag: [Tag.critical, Tag.positive] }, async ({ travelAddons, addonSelection, blocked }) => {
    await searchAddons(travelAddons, blocked);
    const picked = await addFirstTwo(travelAddons);
    await addonSelection.expectItemCount(2);
    expect(await addonSelection.itemCountLabel()).toBe(2);
    const lines = await addonSelection.lines();
    expect(lines.map((l) => l.name).sort()).toEqual(picked.map((p) => p.name).sort());
    for (const line of lines) {
      expect(line.lineTotal, `${line.name}: line total = unit × quantity`).toBe(line.unitPrice * line.quantity);
      expect(line.unitPrice).toBe(picked.find((p) => p.name === line.name)!.unitPrice);
    }
    expect(await addonSelection.total()).toBe(lines.reduce((sum, l) => sum + l.lineTotal, 0));
  });

  test('removing an add-on updates the selection and total', { tag: [Tag.positive] }, async ({ travelAddons, addonSelection, blocked }) => {
    await searchAddons(travelAddons, blocked);
    const [first, second] = await addFirstTwo(travelAddons);
    await addonSelection.removeButton(first.name).click();
    await addonSelection.expectItemCount(1);
    await expect(addonSelection.items.first()).toContainText(second.name);
    expect(await addonSelection.total()).toBe(second.unitPrice);
  });

  test('quantity follows the passenger count', { tag: [Tag.boundary] }, async ({ travelAddons, addonSelection, observe }) => {
    await travelAddons.openAddons();
    await travelAddons.selectDeparture(addonDeparture.code, addonDeparture.searchText);
    await travelAddons.dates.selectDate('Departure', futureDate(dateOffsets.addonDepartureDays));
    await travelAddons.setPassengers({ adults: 2, children: 0, infants: 0 });
    await travelAddons.searchButton.click();
    await travelAddons.waitForOutcome();
    const item = await travelAddons.summaryOf(travelAddons.cards.first());
    await travelAddons.add(travelAddons.card(item.name));
    const [line] = await addonSelection.lines();
    observe(`2 adults -> quantity ${line.quantity}, line total ₦${line.lineTotal}`);
    expect(line.quantity).toBe(2);
    expect(line.lineTotal).toBe(item.unitPrice * 2);
  });

  test('selection persists into the cart with the same total (booking association)', { tag: [Tag.critical, Tag.positive] }, async ({ travelAddons, addonSelection, requireCartCreation, blocked }) => {
    void requireCartCreation;
    await searchAddons(travelAddons, blocked);
    await addFirstTwo(travelAddons);
    const panelTotal = await addonSelection.total();
    const cart = await addonSelection.proceedToCart();
    const summary = await cart.bookingSummaryText();
    expect(summary).toMatch(new RegExp(`Travel Extras ${addonData.from} · 2 add-ons`, 'i'));
    expect(await cart.summary.total()).toBe(panelTotal);
    await expect(cart.timeOfTravel).toBeVisible();
    await expect(cart.pnr).toBeVisible();
    await expect(cart.proceedToPay).toBeDisabled();
  });

  test('cart travel details accept the configured PNR and time of travel', { tag: [Tag.positive] }, async ({ travelAddons, addonSelection, requireCartCreation, blocked }) => {
    void requireCartCreation;
    await searchAddons(travelAddons, blocked);
    await addFirstTwo(travelAddons);
    const cart = await addonSelection.proceedToCart();
    await cart.fillContact(primaryContact);
    await cart.fillTravellers([leadAdult]);
    await cart.pnr.fill(addonData.PNR);
    await expect(cart.pnr).toHaveValue(addonData.PNR);
    const timeValue = await cart.setTimeOfTravel(addonData.timeOfTravel);
    await expect(cart.timeOfTravel).toHaveValue(timeValue);
    await cart.countryOfArrival.select(leadAdult.nationality);
    await cart.acceptTerms();
    await expect(cart.proceedToPay).toBeEnabled({ timeout: 30_000 });
  });
});
