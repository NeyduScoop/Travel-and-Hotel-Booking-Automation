import { test, expect, Tag, credentialSafeArtifacts } from '../../../fixtures/test.fixture';
import { DataFactory } from '../../../utils/data.factory';
import { primeFlightDiscountRate } from '../../../data/prime/prime.data';
import { futureDate } from '../../../utils/date.utils';
import { PrimeBookingPage, primeFlightPax, primeHotelGuests } from '../../../pages/prime/PrimeBookingPage';
import { PriceBreakdown } from '../../../components/booking/PriceBreakdown';
import { fillPrimeTravellers, flightToCart, hotelToCart, primeMembers } from '../../../utils/flows';
import { expectAmountClose } from '../../../utils/assertions';
import { timeouts } from '../../../config/test.config';

// Signed-in tests: no trace/video/screenshot, which could capture credentials (see CLAUDE.md).
test.use(credentialSafeArtifacts);

test.describe('PRIME Flights and Hotels regression', { tag: [Tag.regression, Tag.prime] }, () => {
  test.describe.configure({ timeout: timeouts.bookingFlow });

  test('session is retained across navigation and reload', { tag: [Tag.critical, Tag.positive] }, async ({ signedInPrime, primeBooking, loginPage, page }) => {
    void signedInPrime;
    for (const path of ['/flights', '/hotels', '/']) {
      await primeBooking.goto(path);
      await expect(primeBooking.memberBadge, `PRIME badge on ${path}`).toBeVisible();
    }
    await page.reload();
    await expect(primeBooking.memberBadge).toBeVisible();
    expect(await loginPage.customerUserStored()).toBe(true);
  });

  test('"My account" opens the member profile instead of the login page', { tag: [Tag.negative] }, async ({ signedInPrime, primeBooking, page }) => {
    void signedInPrime;
    await primeBooking.memberBadge.click();
    await page.waitForLoadState('domcontentloaded');
    await expect(page, 'signed-in member must not be sent back to /auth').not.toHaveURL(/\/auth/, { timeout: 15_000 });
  });

  test('PRIME flight cards show member pricing at the advertised discount', { tag: [Tag.primeFlights, Tag.critical] }, async ({ signedInPrime, flightResults, blocked }) => {
    void signedInPrime;
    await flightResults.openFor(DataFactory.oneWayFlight());
    if ((await flightResults.waitForOutcome()).kind === 'empty') blocked('MISSING INVENTORY');
    for (const card of (await flightResults.cards.all()).slice(0, 5)) {
      const s = await flightResults.summaryOf(card);
      const prime = await flightResults.primePriceOf(card);
      expect(prime, `${s.airline}: PRIME price displayed`).not.toBeNull();
      expect(prime!).toBeLessThan(s.price);
      expectAmountClose(prime!, s.price * (1 - primeFlightDiscountRate), `${s.airline} PRIME price vs Full Pay ₦${s.price}`, 1);
    }
  });

  test('PRIME flight cart: passengers are the account\'s eligible PRIME members, Main Traveller kept', { tag: [Tag.primeFlights, Tag.critical] }, async ({ signedInPrime, page, primeAccountPage, primeBooking, requireCartCreation, observe, blocked }) => {
    void signedInPrime; void requireCartCreation;
    const offset = 30;
    const members = await primeMembers(primeAccountPage, blocked);
    const { cart } = await flightToCart(page, DataFactory.oneWayFlight(primeFlightPax(members, futureDate(offset)), 'Economy', offset), blocked);
    expect(await cart.travellerCount(), 'one traveller block per eligible PRIME member').toBe(members.length);
    const main = await primeBooking.mainTravellerSnapshot();
    expect(main.lastName, 'Main Traveller surname prefilled from the account').not.toBe('');
    expect(main.firstName, 'Main Traveller first name prefilled').not.toBe('');
    expect((await cart.contact.values()).email, 'contact email prefilled').not.toBe('');
    const saved = await cart.traveller(1).savedTravellers();
    observe(`Saved travellers offered for traveller 2: ${saved.options.length}`);
    const plan = await fillPrimeTravellers(primeBooking, members, futureDate(offset), 'flight', blocked);
    observe(`Traveller sources: ${plan.sources.join(', ')}`);
    expect(plan.sources, 'no traveller filled from test data').not.toContain('canonical');
    const after = await primeBooking.mainTravellerSnapshot();
    expect(after.lastName, 'Main Traveller not overwritten').toBe(main.lastName);
    expect(after.firstName).toBe(main.firstName);
    expect(plan.filledFields[0], 'no prefilled Main Traveller field was replaced').not.toContain('lastName');
    await cart.acceptTerms();
    await expect(cart.proceedToPay).toBeEnabled({ timeout: 30_000 });
  });

  test('PRIME flight cart total equals the advertised PRIME fare and its own line items', { tag: [Tag.primeFlights, Tag.critical, Tag.negative] }, async ({ signedInPrime, page, primeAccountPage, primeBooking, flightResults, requireCartCreation, blocked }) => {
    void signedInPrime; void requireCartCreation;
    const members = await primeMembers(primeAccountPage, blocked);
    const c = DataFactory.oneWayFlight(primeFlightPax(members, futureDate(30)), 'Economy', 30);
    await flightResults.openFor(c);
    if ((await flightResults.waitForOutcome()).kind === 'empty') blocked('MISSING INVENTORY');
    const primePrice = await flightResults.primePriceOf(flightResults.card(0));
    await flightToCart(page, c, blocked);
    const b = await primeBooking.breakdown();
    const flight = b.sections[0];
    expect(PrimeBookingPage.primeDiscount(b), `PRIME discount line shown in the summary (${b.text.slice(0, 320)})`).toBeGreaterThan(0);
    expect(flight.total, `flight total vs its line items (${b.text.slice(0, 260)})`).toBe(PriceBreakdown.sectionSum(flight));
    expect(flight.total, `cart flight total vs advertised PRIME fare ₦${primePrice}`).toBe(primePrice);
  });

  test('PRIME hotel listing, room and cart show the member discount consistently', { tag: [Tag.primeHotels, Tag.critical] }, async ({ signedInPrime, page, primeAccountPage, primeBooking, requireCartCreation, observe, blocked }) => {
    void signedInPrime; void requireCartCreation;
    const criteria = DataFactory.hotelSearch();
    const members = await primeMembers(primeAccountPage, blocked);
    const { cart, listing, room } = await hotelToCart(page, DataFactory.hotelSearch({ guests: primeHotelGuests(members, criteria.checkIn), rooms: 1 }), blocked);
    const cartPage = new PrimeBookingPage(cart.page);
    const b = await cartPage.breakdown();
    const hotelSection = b.sections[b.sections.length - 1];
    observe(`PRIME hotel: listing full ₦${listing.totalPrice} / PRIME ₦${listing.primePrice}; room full ₦${room.total} / PRIME ₦${room.primePrice}; cart ${b.text.slice(0, 220)}`);
    // Soft assertions so every stage of the PRIME price chain is reported.
    expect.soft(room.total, 'room full price = listing full price').toBe(listing.totalPrice);
    expect.soft(listing.primePrice, 'PRIME price shown on the hotel listing').toBeDefined();
    expect.soft(room.primePrice, 'PRIME price shown on the room').toBeDefined();
    expect.soft(room.primePrice, 'room PRIME price = listing PRIME price').toBe(listing.primePrice);
    expect.soft(hotelSection.total, 'cart charges the PRIME price shown on the room').toBe(room.primePrice);
    expect.soft(hotelSection.total, 'cart hotel total = its line items').toBe(PriceBreakdown.sectionSum(hotelSection));
    void primeBooking;
  });
});
