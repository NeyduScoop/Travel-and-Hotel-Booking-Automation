import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { CartPage } from '../pages/common/CartPage';
import { ConfirmationPage, type ConfirmationData } from '../pages/common/ConfirmationPage';
import { FlightBookingPage } from '../pages/flights/FlightBookingPage';
import { TravelAddonsPage } from '../pages/travel-addons/TravelAddonsPage';
import { AddonSelectionPage } from '../pages/travel-addons/AddonSelectionPage';
import { TourResultsPage } from '../pages/tours/TourResultsPage';
import { TourDetailsPage } from '../pages/tours/TourDetailsPage';
import { TourSearchPage } from '../pages/tours/TourSearchPage';
import { HotelResultsPage } from '../pages/hotels/HotelResultsPage';
import { HotelBookingPage } from '../pages/hotels/HotelBookingPage';
import { HotelSearchPage } from '../pages/hotels/HotelSearchPage';
import { PrimeMemberDataError, type PrimeBookingPage, type PrimeTravellerPlan } from '../pages/prime/PrimeBookingPage';
import type { PrimeAccountPage, PrimeMember } from '../pages/prime/PrimeAccountPage';
import { PaymentBlockedError, PaymentFailedError, PaystackRouteError, type PaymentRoute, type PaymentSection } from '../components/payment/PaymentSection';
import { KalabashCheckoutPage } from '../pages/payment/KalabashCheckoutPage';
import { PaystackCheckoutPage } from '../pages/payment/PaystackCheckoutPage';
import { PriceBreakdown, type ParsedBreakdown } from '../components/booking/PriceBreakdown';
import { addonData, addonDeparture } from '../data/travel-addons/addons.data';
import { leadAdult, primaryContact } from '../data/common/passengers.data';
import { tourSupplierAnswers } from '../data/tours/tour-booking.data';
import { kalabashCredentials, safety, testCard } from '../config/environment.config';
import { futureDate } from './date.utils';
import { DataFactory } from './data.factory';
import type { FlightCardSummary, FlightSearchCriteria } from '../types/flight.types';
import type { AddonCardSummary } from '../types/addon.types';
import type { HotelSearchCriteria, HotelCardSummary } from '../types/hotel.types';
import type { RoomSummary } from '../pages/hotels/HotelDetailsPage';
import type { TourSearchCriteria } from '../types/tour.types';
import type { Traveller } from '../types/common.types';

/**
 * Reusable journey steps shared by regression and E2E specs. Each step drives existing page
 * objects only; nothing here asserts business outcomes beyond "the step reached its next page".
 */

type Blocked = (reason: string) => never;

// ---------- Reaching the cart -------------------------------------------------------------

export async function flightToCart(page: Page, criteria: FlightSearchCriteria, blocked: Blocked) {
  const booking = new FlightBookingPage(page);
  await booking.results.openFor(criteria);
  const outcome = await booking.results.waitForOutcome();
  if (outcome.kind === 'empty') blocked(`MISSING INVENTORY: no flights for ${criteria.origin.code}->${criteria.destination.code} (${criteria.tripType}).`);
  const { summary, attempts } = await booking.selectFirstBookable();
  return { cart: booking.cart, summary, attempts };
}

export async function addonsToCart(page: Page, offsetDays = 30, count = 2) {
  const addons = new TravelAddonsPage(page);
  const selection = new AddonSelectionPage(page);
  await addons.openAddons();
  await addons.search(addonDeparture.code, addonDeparture.searchText, futureDate(offsetDays));
  await addons.waitForOutcome();
  const picked: AddonCardSummary[] = [];
  for (let i = 0; i < count; i += 1) picked.push(await addons.summaryOf(addons.cards.nth(i)));
  for (const p of picked) await addons.add(addons.card(p.name));
  const panelTotal = await selection.total();
  const cart = await selection.proceedToCart();
  return { cart, picked, panelTotal, departureDate: futureDate(offsetDays) };
}

export async function tourToCart(page: Page, criteria: TourSearchCriteria, blocked: Blocked) {
  const results = new TourResultsPage(page);
  const details = new TourDetailsPage(page);
  // A deep link to /tours/results fires no search (observed 2026-11-15), so the search widget is used.
  const search = new TourSearchPage(page);
  await search.openSearch();
  await search.search(criteria);
  const outcome = await results.waitForOutcome();
  if (outcome.kind === 'empty') blocked(`MISSING INVENTORY: no tours for ${criteria.destination}.`);
  const card = results.cards.first();
  const listing = await results.summaryOf(card);
  await results.openDetails(card);
  await details.waitForLoaded();
  const option = await details.ensureOptionSelected();
  const perAdult = await details.fromPricePerAdult();
  const total = await details.summary.total();
  await expect(details.bookNowButton).toBeEnabled({ timeout: 20_000 });
  await details.bookNowButton.click();
  const cart = new CartPage(page);
  await cart.waitForReady();
  return { cart, tour: listing.title, option, perAdult, total };
}

export async function hotelToCart(page: Page, criteria: HotelSearchCriteria, blocked: Blocked) {
  const results = new HotelResultsPage(page);
  // Search through the widget so the configured destination (not a hard-coded place id) is used.
  const search = new HotelSearchPage(page);
  await search.openSearch();
  await search.search(criteria);
  const outcome = await results.waitForOutcome();
  if (outcome.kind === 'empty') blocked(`MISSING INVENTORY: no hotels for ${criteria.destinationOption}.`);
  // Owner rule (2026-11-22): a hotel that cannot be booked (details never load, room reservation fails) is
  // recorded with evidence and the next hotel on the listing is tried. Its defect stays reported (D-01 etc.).
  const failures: string[] = [];
  const max = Math.min(5, await results.cards.count());
  for (let i = 0; i < max; i += 1) {
    const card = results.cards.nth(i);
    const listing: HotelCardSummary = await results.summaryOf(card);
    let tab: Page | undefined;
    try {
      tab = await results.openDeal(card);
      const booking = new HotelBookingPage(tab);
      await booking.details.waitForLoaded();
      // The hotel actually booked, as named on its details page (the results card can differ: D-26).
      const detailsName = (await booking.details.heading.innerText()).trim();
      const { room, cart }: { room: RoomSummary; cart: CartPage } = await booking.reserveFirstRoom();
      return { cart, listing, detailsName, room, tab, failures };
    } catch (error) {
      const message = `${listing.name}: ${(error as Error).message.split('\n')[0]}`;
      failures.push(message);
      const info = test.info();
      info.annotations.push({ type: 'hotel-selection-failure', description: `${message} → moving to the next hotel` });
      const shot = await tab?.screenshot().catch(() => undefined);
      if (shot) await info.attach(`hotel-selection-failure-${failures.length}.png`, { body: shot, contentType: 'image/png' });
      await tab?.close().catch(() => undefined);
    }
  }
  throw new Error(`No hotel could be booked from the first ${max} results. Failures: ${failures.join(' | ')}`);
}

// ---------- Filling the cart ---------------------------------------------------------------

/** Contact + lead traveller + any add-on travel details + supplier questions + Terms. */
export async function completeStandardCart(cart: CartPage, opts: { addonTravel?: boolean; tourQuestions?: boolean; travellers?: Traveller[] } = {}) {
  await cart.fillContact(primaryContact);
  const total = await cart.travellerCount();
  const travellers = opts.travellers ?? DataFactory.travellersFor({ adults: total, children: 0, infants: 0 });
  expect(travellers.length, 'canonical travellers available for every traveller block').toBeGreaterThanOrEqual(total);
  await cart.fillTravellers(travellers, primaryContact);
  if (opts.addonTravel) {
    await cart.setTimeOfTravel(addonData.timeOfTravel);
    await cart.pnr.fill(addonData.PNR);
    await cart.countryOfArrival.select(leadAdult.nationality);
  }
  if (opts.tourQuestions) await cart.answerSupplierQuestions(tourSupplierAnswers);
  await cart.acceptTerms();
  return travellers;
}

// ---------- Paying -----------------------------------------------------------------------

export interface PaymentOutcome {
  route: PaymentRoute;
  option: string;
  /** Human-readable route actually used, e.g. "Card payment → Paystack TEST → Bank Authentication". Recorded in the report. */
  routeDetail: string;
  bookingId: string;
  breakdown: ParsedBreakdown;
  payCardTotal: number;
  makePaymentAmount: number;
  /** Page that shows the Wakanow booking summary (Kalabash returns in a new tab). */
  summaryPage: Page;
  confirmation?: ConfirmationData;
  /** Kalabash only: invoice amount due (compared with Make Payment) and the transaction reference. */
  gateway?: { amountDue?: number; reference?: string; merchant?: string };
}

/** Record the payment route on the test (annotation → summary report) and as an attachment. */
async function recordRoute(testInfo: TestInfo, detail: string): Promise<void> {
  testInfo.annotations.push({ type: 'payment-route', description: detail });
  await testInfo.attach('payment-route.txt', { body: detail, contentType: 'text/plain' });
}

/**
 * Proceed to Pay (creates the booking), then pay by the owner's rule (2026-11-22):
 *  1. Pay at Bank → 2. Bank Transfer Payment (Instant Ticketing) → 3. automated bank transfer (unpaid bookings);
 *  4. otherwise Card: Paystack TEST mode — typed TEST_CARD_* when card input is required, otherwise
 *     "Bank Authentication" → Authenticate;
 *  PRIME bookings (`prime: true`): Kalabash Wallet with the .env Kalabash credentials.
 * Bank routes need ALLOW_TEST_BOOKING_SUBMISSION; Card and Kalabash move (test) money and also need
 * ALLOW_TEST_PAYMENT_AUTHENTICATION. Bot protection is never bypassed. The route used is always recorded.
 */
/**
 * Any page that ends in the shared payment step: the cart, and the visa application's "Review & pay" (observed 2026-11-23).
 * `proceedToPayment()` creates the booking and returns its id; `payment` is the "Payment method" radio group step.
 */
export interface PaymentStep {
  readonly page: Page;
  readonly payment: PaymentSection;
  readonly priceBreakdown: PriceBreakdown;
  proceedToPayment(): Promise<string>;
}

export async function payAndConfirm(cart: PaymentStep, testInfo: TestInfo, blocked: Blocked, opts: { prime?: boolean; exclude?: PaymentRoute[] } = {}): Promise<PaymentOutcome> {
  const bookingId = await cart.proceedToPayment();
  testInfo.annotations.push({ type: 'booking', description: `Booking created: ${bookingId}` });
  const breakdown = await cart.priceBreakdown.read();
  const { route, option, offered } = await cart.payment.preferredRoute(opts);
  if (route === 'NONE' || !option) blocked(`No approved payment route offered (options: ${offered.join(', ')}). Booking ${bookingId} remains unpaid.`);
  const unpaid = `Booking ${bookingId} remains unpaid.`;
  if ((route === 'CARD' || route === 'KALABASH') && !safety.paymentAuthentication) {
    await recordRoute(testInfo, `${option} — not attempted (ALLOW_TEST_PAYMENT_AUTHENTICATION=false)`);
    blocked(`PAYMENT AUTHORISATION REQUIRED: the approved route here is "${option}" (offered: ${offered.join(', ')}); it needs ALLOW_TEST_PAYMENT_AUTHENTICATION=true. ${unpaid}`);
  }
  await cart.payment.select(option!);
  const payCardTotal = await cart.payment.payCardAmount();
  const makePaymentAmount = await cart.payment.makePaymentAmount();
  let summaryPage: Page = cart.page;
  let routeDetail = option!;
  let gateway: PaymentOutcome['gateway'];

  try {
    if (route === 'KALABASH') {
      const creds = kalabashCredentials();
      if (!creds?.pin) blocked(`MISSING CREDENTIALS: Kalabash phone/password/PIN are not configured (KALABASH_* or PhoneNumber/password/pin). ${unpaid}`);
      await cart.payment.submit();
      const kb = new KalabashCheckoutPage(cart.page);
      await kb.waitForCheckout();
      await kb.signIn(creds!);
      await kb.waitForInvoice();
      const amountDue = await kb.amountDue();
      const merchant = await kb.merchant();
      if (!/test/i.test(merchant)) blocked(`Kalabash invoice merchant is "${merchant}", not a test merchant; payment refused. ${unpaid}`);
      if ((await kb.availableBalance()) < amountDue) blocked(`TEST DATA ISSUE: the Kalabash test wallet balance is below the amount due (₦${amountDue}). ${unpaid}`);
      await kb.payWithPin(creds!.pin!);
      gateway = { amountDue, merchant, reference: await kb.receiptField('Transaction ref') };
      summaryPage = await kb.returnToMerchant(/wkn-web-v4|wakanow/i);
      routeDetail = `${option} → Kalabash checkout (${merchant}) → sign-in → PIN → Payment successful`;
    } else if (route === 'CARD') {
      // App-side failures ("Couldn't reserve your booking") stay APPLICATION DEFECTS on every route.
      await cart.payment.submit();
      try {
        const paystack = new PaystackCheckoutPage(cart.page);
        await paystack.waitForCheckout();
        await paystack.assertTestMode();
        if (await paystack.offersTestOutcomes()) {
          await paystack.payWithBankAuthentication();
          routeDetail = `${option} → Paystack TEST → Bank Authentication → Authenticate`;
        } else {
          const card = testCard();
          if (!card) throw new PaymentBlockedError('MISSING CREDENTIALS: the Paystack checkout requires card details and TEST_CARD_* are not configured.');
          await paystack.payWithCard(card);
          routeDetail = `${option} → Paystack TEST → test card from .env`;
        }
        const paystackOutcome = await paystack.waitForSuccessAndReturn();
        if (paystackOutcome === 'success') {
          routeDetail += ' → Paystack showed "Payment Successful"';
        } else {
          routeDetail += ' → Paystack redirected WITHOUT a "Payment Successful" message';
          // PRIME: Paystack did not confirm the payment, i.e. the Paystack route failed (owner rule → Kalabash).
          if (opts.prime) throw new PaymentBlockedError('Paystack redirected back without confirming the payment ("Payment Successful" not shown).');
        }
      } catch (error) {
        // PRIME (owner, 2026-11-22): a Paystack-side failure falls back to Kalabash on a new booking.
        if (opts.prime && !(error instanceof PaymentFailedError)) {
          throw new PaystackRouteError(`Paystack route failed: ${(error as Error).message.split('\n')[0].replace(/^Test is skipped:\s*/, '')}`);
        }
        throw error;
      }
    } else {
      // PAY_AT_BANK, BANK_TRANSFER_INSTANT, BANK_TRANSFER_AUTOMATED: an unpaid booking, settled offline.
      await cart.payment.submit();
      routeDetail = `${option} (unpaid booking, settled offline)`;
    }
  } catch (error) {
    const reason = (error as Error).message.split('\n')[0].replace(/^Test is skipped:\s*/, '');
    await recordRoute(testInfo, `${routeDetail} — stopped: ${reason}`);
    if (error instanceof PaystackRouteError) throw error;
    if (error instanceof PaymentBlockedError) blocked(`${error.message} ${unpaid}`);
    throw error;
  }
  await recordRoute(testInfo, routeDetail);

  const confirmationPage = new ConfirmationPage(summaryPage);
  await confirmationPage.waitForLoaded();
  const confirmation = await confirmationPage.read();
  // Evidence screenshot with e-mail addresses masked (signed-in bookings show the account e-mail).
  await testInfo.attach('confirmation.png', {
    body: await summaryPage.screenshot({ fullPage: true, mask: [summaryPage.getByText(/[\w.+-]+@[\w-]+\.[\w.]+/)] }),
    contentType: 'image/png',
  });
  return { route, option: option!, routeDetail, bookingId, breakdown, payCardTotal, makePaymentAmount, summaryPage, confirmation, gateway };
}

/**
 * PRIME payment rule (owner, updated 2026-11-22): pay with Paystack (Card, TEST mode) first; when Paystack fails
 * on the Paystack side, use Kalabash Wallet. A booking cannot change route after Paystack opens, so `book` runs
 * again on a new booking (attempt 1, with CARD excluded). `book(attempt, exclude)` must search, fill and call
 * `payAndConfirm(..., { prime: true, exclude })`; use `attempt` to move the travel date and avoid
 * duplicate-booking clashes. Both attempts are recorded on the test.
 */
export async function withPaystackFallback<T>(testInfo: TestInfo, book: (attempt: number, exclude: PaymentRoute[]) => Promise<T>): Promise<T> {
  try {
    return await book(0, []);
  } catch (error) {
    if (!(error instanceof PaystackRouteError)) throw error;
    testInfo.annotations.push({ type: 'payment-fallback', description: `${error.message} → retrying with Kalabash Wallet on a new booking` });
    await testInfo.attach('payment-fallback.txt', { body: `${error.message}\nFallback: Kalabash Wallet on a new booking.`, contentType: 'text/plain' });
    return book(1, ['CARD']);
  }
}

/** Independent price check: Σ line items + Σ add-ons vs the displayed grand total (±₦1 display rounding). */
export function priceIntegrity(b: ParsedBreakdown): { expected: number; displayed: number; diff: number } {
  const expected = PriceBreakdown.expectedGrandTotal(b);
  return { expected, displayed: b.grandTotal, diff: Math.abs(expected - b.grandTotal) };
}

export type { FlightCardSummary };

// ---------- PRIME passengers -----------------------------------------------------------------

/**
 * The signed-in account's eligible PRIME members (owner + "★ Prime" travellers). PRIME bookings use exactly
 * these people (owner rule, 2026-11-22), never the canonical test-data passengers.
 */
export async function primeMembers(account: PrimeAccountPage, blocked: Blocked): Promise<PrimeMember[]> {
  const members = await account.eligibleMembers();
  if (!members.length) blocked('TEST DATA ISSUE: the PRIME account has no eligible PRIME members.');
  return members;
}

/** Fill the cart's traveller blocks with the members; a member-data gap becomes BLOCKED (TEST DATA ISSUE). */
export async function fillPrimeTravellers(prime: PrimeBookingPage, members: PrimeMember[], travelDate: Date, product: 'flight' | 'hotel', blocked: Blocked): Promise<PrimeTravellerPlan> {
  try {
    return await prime.completeWithMembers(members, travelDate, product);
  } catch (error) {
    if (error instanceof PrimeMemberDataError) blocked(error.message);
    throw error;
  }
}

/** Names as printed on the confirmation (upper case; hyphens become spaces, e.g. "EZE OBIOJU"). */
export const confirmationName = (s: string): string => s.toUpperCase().replace(/[-\s]+/g, ' ').trim();
