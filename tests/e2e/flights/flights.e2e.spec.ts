import { test, expect, Tag } from '../../../fixtures/test.fixture';
import { DataFactory } from '../../../utils/data.factory';
import { completeStandardCart, payAndConfirm, priceIntegrity } from '../../../utils/flows';
import { IntegrityCheck, paymentChecks, dateVariants, flightNumberVariants, baggageVariants } from '../../../utils/confirmation';
import { FlightBookingPage } from '../../../pages/flights/FlightBookingPage';
import { FlightDetailsPage } from '../../../pages/flights/FlightDetailsPage';
import { timeouts } from '../../../config/test.config';
import type { Page, TestInfo } from '@playwright/test';
import type { FlightSearchCriteria, MultiCityLegCriteria } from '../../../types/flight.types';
import type { Traveller } from '../../../types/common.types';
import type { FlightSearchPage } from '../../../pages/flights/FlightSearchPage';

/**
 * Standard Flights E2E (Project.md §8–§10, §22–§32). Search through the widget, validate results and
 * details, select, complete PAX + Terms, validate the summary, pay by the approved route, confirm.
 * DEVTEST flights offer no "Pay at Bank": the card route is used when authorised, and is reported
 * BLOCKED when the hosted gateway cannot be automated (Cloudflare bot verification on Paystack).
 */
async function bookAndConfirm(
  page: Page, flightSearch: FlightSearchPage, testInfo: TestInfo, blocked: (r: string) => never,
  search: () => Promise<void>, expectLegs: { origin: string; destination: string; date: Date }[], travellers: Traveller[] | undefined, cabin: string,
) {
  const booking = new FlightBookingPage(page);
  const details = new FlightDetailsPage(page);
  await search();
  const outcome = await booking.results.waitForOutcome();
  if (outcome.kind === 'empty') blocked('MISSING INVENTORY: no flights for the configured search.');
  const card = booking.results.card(0);
  const listing = await booking.results.summaryOf(card);
  await details.expand(card);
  const flightNumbers = await details.flightNumbers(card);
  expect(flightNumbers.length, 'flight numbers in details').toBeGreaterThan(0);
  await details.collapse(card);
  const { attempts } = await booking.selectFirstBookable();
  testInfo.annotations.push({ type: 'observation', description: `Selection attempts: ${attempts.map((a) => a.outcome).join(', ')}` });
  const cart = booking.cart;
  const summaryText = await cart.bookingSummaryText();
  for (const leg of expectLegs) expect(summaryText).toContain(leg.origin);
  const filled = await completeStandardCart(cart, { travellers });
  const pay = await payAndConfirm(cart, testInfo, blocked);
  const conf = pay.confirmation!;
  const check = new IntegrityCheck('Flight confirmation');
  check.equal('Booking reference', pay.bookingId, conf.bookingId);
  for (const leg of expectLegs) {
    check.contains(`Origin ${leg.origin}`, leg.origin, conf.text).contains(`Destination ${leg.destination}`, leg.destination, conf.text).containsAny(`Date ${leg.origin}-${leg.destination}`, dateVariants(leg.date), conf.text);
  }
  // The confirmation prints flight numbers without the airline code ("Flight no: 535" for KQ535, observed 2026-11-22).
  for (const n of flightNumbers) check.containsAny(`Flight number ${n}`, flightNumberVariants(n), conf.text);
  check.contains('Airline', listing.airline, conf.text).contains('Cabin', cabin, conf.text);
  for (const t of filled) check.contains(`Passenger ${t.firstName}`, `${t.lastName}`, conf.text);
  // Card "1 × 7kg cabin" / "2 × 23kg checked" is printed as "BAGGAGE 1 bag · 7kg" / "CHECK IN 2 bags · 23kg".
  for (const bag of listing.baggage) check.containsAny(`Baggage ${bag}`, baggageVariants(bag), conf.text);
  const integrity = priceIntegrity(pay.breakdown);
  check.equal('Summary total = Σ line items', integrity.expected, integrity.displayed).contains('Currency', '₦', conf.text);
  paymentChecks(check, pay);
  await check.assert(testInfo);
}

test.describe('Flights E2E', { tag: [Tag.e2e, Tag.flights, Tag.confirmation] }, () => {
  test.describe.configure({ timeout: timeouts.bookingFlow * 2 });

  test('one-way departure→destination: search → select → PAX → pay → confirmation', { tag: [Tag.critical] }, async ({ page, flightSearch, requireBookingSubmission, blocked }, testInfo) => {
    void requireBookingSubmission;
    const c: FlightSearchCriteria = DataFactory.oneWayFlight(undefined, 'Economy', DataFactory.e2eOffsetDays());
    await bookAndConfirm(page, flightSearch, testInfo, blocked, async () => {
      await flightSearch.openSearch();
      await flightSearch.fill(c);
      await flightSearch.submit();
    }, [{ origin: c.origin.code, destination: c.destination.code, date: c.departureDate }], undefined, c.cabin);
  });

  test('round-trip with canonical 2 adults / 1 child / 1 infant: search → select → PAX → pay → confirmation', { tag: [Tag.critical] }, async ({ page, flightSearch, requireBookingSubmission, blocked }, testInfo) => {
    void requireBookingSubmission;
    const c = DataFactory.flightSearch({}, DataFactory.e2eOffsetDays());
    await bookAndConfirm(page, flightSearch, testInfo, blocked, async () => {
      await flightSearch.openSearch();
      await flightSearch.fill(c);
      await flightSearch.submit();
    }, [
      { origin: c.origin.code, destination: c.destination.code, date: c.departureDate },
      { origin: c.destination.code, destination: c.origin.code, date: c.returnDate! },
    ], DataFactory.travellersFor(c.passengers), c.cabin);
  });

  test('multi-city departure→destination→departure: search → select → PAX → pay → confirmation', { tag: [Tag.critical] }, async ({ page, flightSearch, requireBookingSubmission, blocked }, testInfo) => {
    void requireBookingSubmission;
    const legs: MultiCityLegCriteria[] = DataFactory.multiCityLegs(DataFactory.e2eOffsetDays());
    await bookAndConfirm(page, flightSearch, testInfo, blocked, async () => {
      await flightSearch.openSearch();
      await flightSearch.fillMultiCity(legs, { adults: 1, children: 0, infants: 0 });
      await flightSearch.submit();
    }, legs.map((l) => ({ origin: l.origin.code, destination: l.destination.code, date: l.date })), undefined, legs[0].cabin);
  });
});
