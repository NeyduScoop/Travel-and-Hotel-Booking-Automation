import { test, expect, Tag, credentialSafeArtifacts } from '../../../fixtures/test.fixture';
import { DataFactory } from '../../../utils/data.factory';
import { confirmationName, fillPrimeTravellers, hotelToCart, payAndConfirm, primeMembers, priceIntegrity, withPaystackFallback } from '../../../utils/flows';
import { IntegrityCheck, paymentChecks, dateVariants, hotelRoomPriceOnSummary } from '../../../utils/confirmation';
import { PrimeBookingPage, primeHotelGuests } from '../../../pages/prime/PrimeBookingPage';
import { futureDate, addDays } from '../../../utils/date.utils';
import { timeouts } from '../../../config/test.config';

// Signed-in tests: no trace/video/screenshot, which could capture credentials (see CLAUDE.md).
test.use(credentialSafeArtifacts);

test.describe('PRIME Hotels E2E', { tag: [Tag.e2e, Tag.primeHotels, Tag.prime, Tag.confirmation, Tag.payment] }, () => {
  // Up to two bookings (Paystack, then the Kalabash fallback).
  test.describe.configure({ timeout: timeouts.bookingFlow * 5 });

  test('signed-in PRIME member: account members as guests → room (new tab) → Paystack (Kalabash fallback) → confirmation', { tag: [Tag.critical] }, async ({ page, signedInPrime, primeAccountPage, requireBookingSubmission, observe, blocked }, testInfo) => {
    void signedInPrime; void requireBookingSubmission;
    // Guests = the account's eligible PRIME members (never test-data passengers); one room.
    const members = await primeMembers(primeAccountPage, blocked);

    const r = await withPaystackFallback(testInfo, async (attempt, exclude) => {
      // The fallback attempt books later dates so it never clashes with the first booking.
      const checkIn = futureDate(DataFactory.e2eOffsetDays() + attempt * 7);
      const guests = primeHotelGuests(members, checkIn);
      observe(`Attempt ${attempt + 1}: PRIME members ${members.length} → ${guests.adults} adult(s), ${guests.children} child(ren)`);
      const criteria = DataFactory.hotelSearch({ checkIn, checkOut: addDays(checkIn, 3), guests, rooms: 1 });
      const { cart, listing, detailsName, room } = await hotelToCart(page, criteria, blocked);
      const prime = new PrimeBookingPage(cart.page);
      const blocks = await cart.travellerCount();
      const main = await prime.mainTravellerSnapshot();
      expect(main.lastName, 'prefilled Main Traveller').not.toBe('');
      const plan = await fillPrimeTravellers(prime, members, checkIn, 'hotel', blocked);
      observe(`Guest sources: ${plan.sources.join(', ')}`);
      expect((await prime.mainTravellerSnapshot()).lastName, 'Main Traveller preserved').toBe(main.lastName);
      await cart.acceptTerms();
      const pay = await payAndConfirm(cart, testInfo, blocked, { prime: true, exclude });
      return { criteria, guests, listing, detailsName, room, blocks, plan, pay };
    });

    const { criteria, guests, listing, detailsName, room, blocks, plan, pay } = r;
    const conf = pay.confirmation!;
    const confText = confirmationName(conf.text);
    const check = new IntegrityCheck('PRIME hotel confirmation');
    check
      .equal('Booking reference', pay.bookingId, conf.bookingId)
      .equal('Searched guests = eligible PRIME members', members.length, guests.adults + guests.children)
      .containsAny('Occupancy = PRIME members', [`${guests.adults} adult${guests.adults === 1 ? '' : 's'}${guests.children ? `, ${guests.children} child${guests.children === 1 ? '' : 'ren'}` : ''}`], conf.text)
      .equal('Guest forms filled with PRIME members', blocks, plan.members.length)
      .contains('Hotel (as booked on its details page)', detailsName, conf.text)
      .observe('Hotel name on the results card', listing.name, conf.text, 'D-26; asserted in hotel-details.regression')
      .contains('Room', room.name, conf.text)
      .containsAny('Check-in', dateVariants(criteria.checkIn), conf.text)
      .containsAny('Check-out', dateVariants(criteria.checkOut), conf.text)
      .equal('PRIME room price = Stay Total + Service Charge on the summary', room.primePrice ?? room.total, hotelRoomPriceOnSummary(conf.text) ?? '(not found on confirmation)');
    plan.members.forEach((m, i) => check.contains(`PRIME member ${i + 1} on the booking`, confirmationName(m.traveller.lastName), confText, 'name normalised: upper case, hyphen = space'));
    const integrity = priceIntegrity(pay.breakdown);
    check.equal('Summary total = Σ line items (incl. PRIME discount)', integrity.expected, integrity.displayed);
    paymentChecks(check, pay);
    await check.assert(testInfo);
  });
});
