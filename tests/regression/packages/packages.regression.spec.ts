import { test, expect, Tag } from '../../../fixtures/test.fixture';
import { DataFactory } from '../../../utils/data.factory';
import { packageData, packageDestinationLabel, packageDestinationsInPriority } from '../../../data/packages/package.data';
import { PackageBuilderPage } from '../../../pages/packages/PackageBuilderPage';
import { PackageFallbackLog } from '../../../pages/packages/PackageSearchPage';
import { priceIntegrity } from '../../../utils/flows';
import { isoDate } from '../../../utils/date.utils';
import { timeouts } from '../../../config/test.config';
import type { PackageDestination } from '../../../types/package.types';

test.describe('Packages regression', { tag: [Tag.regression, Tag.packages] }, () => {
  test.describe.configure({ timeout: timeouts.bookingFlow });

  test('package fallback: configured destinations are tried in priority order until one has results', { tag: [Tag.critical, Tag.positive] }, async ({ packageSearch, packageBuilder, observe, blocked }) => {
    const log = new PackageFallbackLog();
    let used: PackageDestination | undefined;
    for (const destination of packageDestinationsInPriority) {
      await packageSearch.openSearch();
      if (!(await packageSearch.tryFill(DataFactory.packageSearch(destination)))) {
        log.record({ destination: packageDestinationLabel(destination), outcome: 'no-suggestion', reason: 'destination could not be selected in the search widget' });
        continue;
      }
      await packageSearch.build();
      const outcome = await packageBuilder.hotelResults.waitForOutcome();
      if (outcome.kind === 'results') {
        log.record({ destination: packageDestinationLabel(destination), outcome: 'used' });
        used = destination;
        break;
      }
      log.record({ destination: packageDestinationLabel(destination), outcome: 'no-results', reason: outcome.message.slice(0, 120) });
    }
    observe(`Package destinations attempted: ${log.summary()}`);
    if (!used) blocked(`MISSING INVENTORY: every configured package destination failed (${log.summary()}).`);
    // The fallback order is never reshuffled and no unconfigured destination is tried.
    expect(log.attempts.map((a) => a.destination)).toEqual(packageDestinationsInPriority.slice(0, log.attempts.length).map(packageDestinationLabel));
  });

  test('hotel step results match the package search criteria', { tag: [Tag.positive] }, async ({ packageSearch, packageBuilder, blocked }) => {
    const c = DataFactory.packageSearch();
    await packageSearch.openSearch();
    await packageSearch.fill(c);
    await packageSearch.build();
    if ((await packageBuilder.hotelResults.waitForOutcome()).kind === 'empty') blocked('MISSING INVENTORY: no package hotels for the primary destination.');
    const url = new URL(packageBuilder.page.url());
    expect(url.searchParams.get('context')).toBe('holidays');
    expect(url.searchParams.get('destination')).toBe(c.destination);
    expect(url.searchParams.get('checkIn')).toBe(isoDate(c.departureDate));
    expect(url.searchParams.get('checkOut')).toBe(isoDate(c.returnDate));
    expect(url.searchParams.get('adults')).toBe(String(packageData.travellers));
    for (const h of await packageBuilder.hotelResults.summaries()) expect(h.nights).toBe(5);
  });

  test('package hotel details keep the listing hotel name', { tag: [Tag.negative] }, async ({ packageSearch, packageBuilder, blocked }) => {
    await packageSearch.openSearch();
    await packageSearch.fill(DataFactory.packageSearch());
    await packageSearch.build();
    if ((await packageBuilder.hotelResults.waitForOutcome()).kind === 'empty') blocked('MISSING INVENTORY');
    const { listing, tab } = await packageBuilder.openHotel();
    const heading = (await tab.locator('main').first().getByRole('heading', { level: 1 }).innerText()).trim();
    expect(heading.toLowerCase(), 'details heading should name the hotel chosen on the listing').toBe(listing.name.toLowerCase());
  });

  test('room reservation advances to the round-trip flight step for the package route', { tag: [Tag.critical, Tag.positive] }, async ({ packageSearch, packageBuilder, requireCartCreation, blocked }) => {
    void requireCartCreation;
    const c = DataFactory.packageSearch();
    await packageSearch.openSearch();
    await packageSearch.fill(c);
    await packageSearch.build();
    if ((await packageBuilder.hotelResults.waitForOutcome()).kind === 'empty') blocked('MISSING INVENTORY');
    const { tab } = await packageBuilder.openHotel();
    const { flights } = await PackageBuilderPage.reserveRoom(tab);
    const url = new URL(tab.url());
    expect(url.searchParams.get('origin')).toBe(c.departure.code);
    expect(url.searchParams.get('tripType')).toBe('round-trip');
    expect(url.searchParams.get('departureDate')).toBe(isoDate(c.departureDate));
    expect(url.searchParams.get('returnDate')).toBe(isoDate(c.returnDate));
    expect(url.searchParams.get('adults')).toBe(String(c.adults));
    await flights.waitForOutcome();
  });

  test('package cart contains hotel and flight, and its total equals the line items', { tag: [Tag.critical, Tag.negative] }, async ({ packageSearch, packageBuilder, requireCartCreation, blocked }) => {
    void requireCartCreation;
    await packageSearch.openSearch();
    await packageSearch.fill(DataFactory.packageSearch());
    await packageSearch.build();
    if ((await packageBuilder.hotelResults.waitForOutcome()).kind === 'empty') blocked('MISSING INVENTORY');
    const { tab } = await packageBuilder.openHotel();
    const { room, flights } = await PackageBuilderPage.reserveRoom(tab);
    const { flight, cart } = await PackageBuilderPage.bookFlight(flights);
    const summary = await cart.bookingSummaryText();
    expect(summary).toMatch(/Hotel/i);
    expect(summary).toMatch(/Flight/i);
    expect(summary, 'hotel line shows the reserved room total').toContain(`₦${room.total.toLocaleString('en-US')}`);
    const b = await cart.priceBreakdown.readWithLines();
    expect(b.sections.length, 'flight and hotel price sections').toBeGreaterThanOrEqual(2);
    const { expected, displayed } = priceIntegrity(b);
    // Soft assertions: both pricing checks are always reported, even when the first one fails.
    expect.soft(displayed, `package total = Σ line items + add-ons (${b.text.slice(0, 300)})`).toBe(expected);
    const flightSection = b.sections[0];
    expect.soft(flightSection.total, `flight price charged vs flight price shown on the booking summary line (₦${flight.price})`).toBe(flight.price);
  });
});
