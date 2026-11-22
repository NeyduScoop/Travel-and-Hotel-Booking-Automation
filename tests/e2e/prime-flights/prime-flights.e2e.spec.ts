import { test, expect, Tag, credentialSafeArtifacts } from '../../../fixtures/test.fixture';
import { DataFactory } from '../../../utils/data.factory';
import { confirmationName, fillPrimeTravellers, flightToCart, payAndConfirm, primeMembers, priceIntegrity, withPaystackFallback } from '../../../utils/flows';
import { IntegrityCheck, paymentChecks, dateVariants } from '../../../utils/confirmation';
import { PrimeBookingPage, primeFlightPax } from '../../../pages/prime/PrimeBookingPage';
import { futureDate } from '../../../utils/date.utils';
import { timeouts } from '../../../config/test.config';

// Signed-in tests: no trace/video/screenshot, which could capture credentials (see CLAUDE.md).
test.use(credentialSafeArtifacts);

test.describe('PRIME Flights E2E', { tag: [Tag.e2e, Tag.primeFlights, Tag.prime, Tag.confirmation, Tag.payment] }, () => {
  // Up to two bookings (Paystack, then the Kalabash fallback).
  test.describe.configure({ timeout: timeouts.bookingFlow * 5 });

  test('signed-in PRIME member: account members as passengers → member fare → Paystack (Kalabash fallback) → confirmation', { tag: [Tag.critical] }, async ({ page, signedInPrime, primeAccountPage, primeBooking, flightResults, requireBookingSubmission, observe, blocked }, testInfo) => {
    void signedInPrime; void requireBookingSubmission;
    // Passengers = the account's eligible PRIME members (never test-data passengers).
    const members = await primeMembers(primeAccountPage, blocked);

    const r = await withPaystackFallback(testInfo, async (attempt, exclude) => {
      // The fallback attempt books a later date so it never clashes with the first booking.
      const offset = DataFactory.e2eOffsetDays() + attempt * 7;
      const departure = futureDate(offset);
      const pax = primeFlightPax(members, departure);
      observe(`Attempt ${attempt + 1}: PRIME members ${members.length} → ${pax.adults} adult(s), ${pax.children} child(ren), ${pax.infants} infant(s)`);
      const c = DataFactory.oneWayFlight(pax, 'Economy', offset);
      await flightResults.openFor(c);
      if ((await flightResults.waitForOutcome()).kind === 'empty') blocked('MISSING INVENTORY');
      const listingPrime = await flightResults.primePriceOf(flightResults.card(0));
      const { cart, summary } = await flightToCart(page, c, blocked);
      const blocks = await cart.travellerCount();
      const main = await primeBooking.mainTravellerSnapshot();
      expect(main.lastName, 'prefilled Main Traveller').not.toBe('');
      const plan = await fillPrimeTravellers(primeBooking, members, departure, 'flight', blocked);
      observe(`Traveller sources: ${plan.sources.join(', ')}`);
      expect((await primeBooking.mainTravellerSnapshot()).lastName, 'Main Traveller preserved').toBe(main.lastName);
      await cart.acceptTerms();
      const discount = PrimeBookingPage.primeDiscount(await primeBooking.breakdown());
      const pay = await payAndConfirm(cart, testInfo, blocked, { prime: true, exclude });
      return { c, listingPrime, summary, blocks, plan, discount, pay };
    });

    const { c, listingPrime, summary, blocks, plan, discount, pay } = r;
    const conf = pay.confirmation!;
    const confText = confirmationName(conf.text);
    const check = new IntegrityCheck('PRIME flight confirmation');
    check
      .equal('Booking reference', pay.bookingId, conf.bookingId)
      .equal('Cart passengers = eligible PRIME members', members.length, blocks)
      .equal('PRIME discount displayed in summary', 'yes', discount > 0 ? 'yes' : 'no')
      .equal('Original (Full Pay) price > PRIME price', 'yes', listingPrime !== null && listingPrime < summary.price ? 'yes' : 'no')
      .equal('Flight total = advertised PRIME fare', listingPrime ?? '', PrimeBookingPage.sectionTotal(pay.breakdown))
      .containsAny('Departure date', dateVariants(c.departureDate), conf.text)
      .contains('Route', c.destination.code, conf.text);
    plan.members.forEach((m, i) => check.contains(`PRIME member ${i + 1} on the booking`, confirmationName(m.traveller.lastName), confText, 'name normalised: upper case, hyphen = space'));
    const integrity = priceIntegrity(pay.breakdown);
    check.equal('Summary total = Σ line items (incl. PRIME discount)', integrity.expected, integrity.displayed);
    paymentChecks(check, pay);
    await check.assert(testInfo);
  });
});
