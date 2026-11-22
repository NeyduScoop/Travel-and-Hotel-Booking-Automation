import { test, expect, Tag } from '../../../fixtures/test.fixture';
import { DataFactory } from '../../../utils/data.factory';
import { packageDestinationsInPriority } from '../../../data/packages/package.data';
import { PackageBuilderPage } from '../../../pages/packages/PackageBuilderPage';
import { PackageFallbackLog } from '../../../pages/packages/PackageSearchPage';
import { completeStandardCart, payAndConfirm, priceIntegrity } from '../../../utils/flows';
import { IntegrityCheck, paymentChecks, dateVariants } from '../../../utils/confirmation';
import { HotelDetailsPage } from '../../../pages/hotels/HotelDetailsPage';
import { timeouts } from '../../../config/test.config';

test.describe('Packages E2E', { tag: [Tag.e2e, Tag.packages, Tag.confirmation] }, () => {
  test.describe.configure({ timeout: timeouts.bookingFlow * 2 });

  test('fallback destination → hotel (new tab) → room → flight → PAX → pay → confirmation', { tag: [Tag.critical] }, async ({ packageSearch, packageBuilder, requireBookingSubmission, observe, blocked }, testInfo) => {
    void requireBookingSubmission;
    const offset = DataFactory.e2eOffsetDays();
    const log = new PackageFallbackLog();
    let criteria;
    for (const destination of packageDestinationsInPriority) {
      await packageSearch.openSearch();
      const c = DataFactory.packageSearch(destination, offset);
      if (!(await packageSearch.tryFill(c))) { log.record({ destination, outcome: 'no-suggestion' }); continue; }
      await packageSearch.build();
      const outcome = await packageBuilder.hotelResults.waitForOutcome();
      if (outcome.kind === 'results') { log.record({ destination, outcome: 'used' }); criteria = c; break; }
      log.record({ destination, outcome: 'no-results', reason: outcome.message.slice(0, 100) });
    }
    observe(`Package destinations: ${log.summary()}`);
    if (!criteria) blocked(`MISSING INVENTORY: no configured package destination returned hotels (${log.summary()}).`);

    const { listing, tab } = await packageBuilder.openHotel();
    // The hotel actually booked, as named on its details page (the results card can differ: D-26).
    const details = new HotelDetailsPage(tab);
    await details.waitForLoaded();
    const detailsName = (await details.heading.innerText()).trim();
    let reserved;
    try {
      reserved = await PackageBuilderPage.reserveRoom(tab);
    } catch (e) {
      throw new Error(`APPLICATION DEFECT (hotel room selection in package flow): ${(e as Error).message}`);
    }
    const { flight, cart } = await PackageBuilderPage.bookFlight(reserved.flights);
    const summary = await cart.bookingSummaryText();
    expect(summary).toMatch(/Hotel/i);
    expect(summary).toMatch(/Flight/i);
    const filled = await completeStandardCart(cart, { travellers: DataFactory.travellersFor({ adults: criteria!.adults, children: 0, infants: 0 }) });
    const pay = await payAndConfirm(cart, testInfo, blocked);
    const conf = pay.confirmation!;
    const check = new IntegrityCheck('Package confirmation');
    check
      .equal('Booking reference', pay.bookingId, conf.bookingId)
      .contains('Departure', criteria!.departure.code, conf.text)
      .contains('Destination', criteria!.destination, conf.text)
      .containsAny('Departure date', dateVariants(criteria!.departureDate), conf.text)
      .containsAny('Return date', dateVariants(criteria!.returnDate), conf.text)
      .contains('Hotel (as booked on its details page)', detailsName, conf.text)
      .observe('Hotel name on the results card', listing.name, conf.text, 'D-26; asserted in packages.regression "package hotel details keep the listing hotel name"')
      .contains('Room', reserved.room.name, conf.text)
      .contains('Flight airline', flight.airline, conf.text);
    for (const t of filled) check.contains(`Traveller ${t.firstName}`, t.lastName, conf.text);
    const integrity = priceIntegrity(pay.breakdown);
    check.equal('Summary total = Σ line items', integrity.expected, integrity.displayed);
    paymentChecks(check, pay);
    await check.assert(testInfo);
  });
});
