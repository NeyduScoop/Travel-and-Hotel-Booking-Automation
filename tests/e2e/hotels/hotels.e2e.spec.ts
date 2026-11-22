import { test, expect, Tag } from '../../../fixtures/test.fixture';
import { DataFactory } from '../../../utils/data.factory';
import { completeStandardCart, hotelToCart, payAndConfirm, priceIntegrity } from '../../../utils/flows';
import { IntegrityCheck, paymentChecks, dateVariants, hotelRoomPriceOnSummary, nairaAfter } from '../../../utils/confirmation';
import { futureDate, nightsBetween, addDays } from '../../../utils/date.utils';
import { timeouts } from '../../../config/test.config';

test.describe('Hotels E2E', { tag: [Tag.e2e, Tag.hotels, Tag.confirmation] }, () => {
  test.describe.configure({ timeout: timeouts.bookingFlow * 2 });

  test('Primary destination: search → hotel (new tab) → room → guests → add-ons → pay → confirmation', { tag: [Tag.critical] }, async ({ page, requireBookingSubmission, blocked }, testInfo) => {
    void requireBookingSubmission;
    const checkIn = futureDate(DataFactory.e2eOffsetDays());
    const criteria = DataFactory.hotelSearch({ checkIn, checkOut: addDays(checkIn, 3) });
    const { cart, listing, detailsName, room } = await hotelToCart(page, criteria, blocked);
    expect(room.total, 'room total = listing total').toBe(listing.totalPrice);
    const guests = DataFactory.travellersFor({ adults: criteria.guests.adults, children: criteria.guests.children, infants: 0 });
    const filled = await completeStandardCart(cart, { travellers: guests });
    const addons = (await cart.tripAddons.list()).filter((a) => a.selected);
    const pay = await payAndConfirm(cart, testInfo, blocked);
    const conf = pay.confirmation!;
    const nights = nightsBetween(criteria.checkIn, criteria.checkOut);
    const check = new IntegrityCheck('Hotel confirmation');
    check
      .equal('Booking reference', pay.bookingId, conf.bookingId)
      .contains('Hotel (as booked on its details page)', detailsName, conf.text)
      // Owner (2026-11-22): a results-card name that differs from the booked hotel's name must not fail the E2E.
      // Recorded here; asserted by the hotel-details regression test (D-26).
      .observe('Hotel name on the results card', listing.name, conf.text, 'D-26; asserted in hotel-details.regression')
      .contains('Room', room.name, conf.text)
      .containsAny('Check-in', dateVariants(criteria.checkIn), conf.text)
      .containsAny('Check-out', dateVariants(criteria.checkOut), conf.text)
      .contains('Nights', `${nights} night`, conf.text)
      .equal('Room price = Stay Total + Service Charge on the summary', room.total, hotelRoomPriceOnSummary(conf.text) ?? '(not found on confirmation)');
    for (const g of filled) check.contains(`Guest ${g.firstName}`, g.lastName, conf.text);
    // Owner (2026-11-22): the confirmation lists only "Addons Total", so add-on names are recorded, not failed (D-24).
    // The Addons Total check below stays mandatory.
    for (const a of addons) check.observe(`Add-on ${a.name} named on the confirmation`, a.name, conf.text, 'D-24 / REG-003');
    if (addons.length) check.equal('Addons Total = selected add-ons', addons.reduce((s, a) => s + a.price, 0), nairaAfter(conf.text, 'Addons Total') ?? '(not found on confirmation)');
    const integrity = priceIntegrity(pay.breakdown);
    check.equal('Summary total = Σ line items', integrity.expected, integrity.displayed);
    paymentChecks(check, pay);
    await check.assert(testInfo);
  });
});
