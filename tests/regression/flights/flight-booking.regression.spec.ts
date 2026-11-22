import { test, expect, Tag } from '../../../fixtures/test.fixture';
import { DataFactory } from '../../../utils/data.factory';
import { leadAdult, passengerData, primaryContact } from '../../../data/common/passengers.data';
import { cartValidationMessages, invalidContactInputs } from '../../../data/common/validation.data';
import { ContactForm } from '../../../components/forms/ContactForm';
import { timeouts } from '../../../config/test.config';
import type { FlightBookingPage } from '../../../pages/flights/FlightBookingPage';
import type { FlightSearchCriteria } from '../../../types/flight.types';

async function toCart(flightBooking: FlightBookingPage, criteria: FlightSearchCriteria, blocked: (r: string) => never) {
  await flightBooking.results.openFor(criteria);
  const outcome = await flightBooking.results.waitForOutcome();
  if (outcome.kind === 'empty') blocked(`No flight inventory for ${criteria.origin.code}->${criteria.destination.code}.`);
  return flightBooking.selectFirstBookable();
}

test.describe('Flights regression – selection, cart and traveller form', { tag: [Tag.regression, Tag.flights] }, () => {
  test.describe.configure({ timeout: timeouts.bookingFlow });
  // Cart creation is a side effect: never on environments that forbid it (PRODUCTION).
  test.beforeEach(async ({ requireCartCreation }) => requireCartCreation);

  test('selected flight carries route, price, duration and baggage into the cart (REG-008/REG-009)', { tag: [Tag.critical, Tag.positive] }, async ({ flightBooking, observe, blocked }) => {
    const { summary, attempts } = await toCart(flightBooking, DataFactory.oneWayFlight(), blocked);
    observe(`Selection attempts: ${JSON.stringify(attempts)}`);
    const cart = flightBooking.cart;
    const text = await cart.bookingSummaryText();
    expect(text).toContain(`${summary.origin} → ${summary.destination}`);
    expect(text).toContain(summary.airline);
    const hours = Math.floor(summary.durationMinutes / 60);
    const minutes = summary.durationMinutes % 60;
    expect(text, 'listing duration must match cart duration (REG-009)').toContain(`${hours}h ${minutes}m`);
    for (const bag of summary.baggage) expect(text.toLowerCase(), 'listing baggage must match cart baggage (REG-008)').toContain(bag.toLowerCase());
    // The panel first shows a bare "Total" and repriced line items (service charge, add-ons) arrive later
    // (observed 2026-11-22); compare only once the lines are in, so an early read cannot pass by timing.
    const breakdown = await cart.priceBreakdown.readWithLines();
    const addons = breakdown.addons.reduce((s, a) => s + a.amount, 0);
    expect(breakdown.grandTotal - addons, `cart total (excluding ₦${addons} pre-selected add-ons, D-13) equals listing price: ${breakdown.text.slice(0, 250)}`).toBe(summary.price);
    expect(await cart.summary.ctaAmount(/^Proceed to Pay/), '"Proceed to Pay" = listing price + selected add-ons').toBe(summary.price + addons);
  });

  test('Proceed to Pay stays disabled until traveller details are complete', { tag: [Tag.negative, Tag.critical] }, async ({ flightBooking, blocked }) => {
    await toCart(flightBooking, DataFactory.oneWayFlight(), blocked);
    await expect(flightBooking.cart.proceedToPay).toBeDisabled();
    await expect(flightBooking.cart.paymentHeading).toBeVisible();
  });

  test('required-field and format validation messages are shown', { tag: [Tag.negative] }, async ({ flightBooking, blocked }) => {
    await toCart(flightBooking, DataFactory.oneWayFlight(), blocked);
    const cart = flightBooking.cart;
    const t = cart.traveller(0);
    await cart.contact.email.fill(invalidContactInputs.emails[0]);
    await cart.contact.phone.fill(invalidContactInputs.phones.wayTooShort);
    // The canonical routes are international, so passport details must be collected (observed missing on a LOS-DXB Royal Air Maroc cart, 2026-11-16).
    await expect(t.passportNumber, 'international flight must collect the passport number').toBeVisible();
    for (const field of [t.surname, t.firstName, t.passportNumber, t.surname]) await field.click();
    expect(await ContactForm.errorFor(cart.contact.email)).toBe(cartValidationMessages.invalidEmail);
    const alerts = await cart.visibleAlerts();
    for (const msg of [cartValidationMessages.invalidPhone, cartValidationMessages.surnameRequired, cartValidationMessages.firstNameRequired, cartValidationMessages.passportRequired]) {
      expect(alerts).toContain(msg);
    }
    await expect(cart.proceedToPay).toBeDisabled();
  });

  for (const email of invalidContactInputs.emails) {
    test(`invalid email "${email}" is rejected`, { tag: [Tag.negative] }, async ({ flightBooking, blocked }) => {
      await toCart(flightBooking, DataFactory.oneWayFlight(), blocked);
      const cart = flightBooking.cart;
      await cart.contact.email.fill(email);
      await cart.contact.phone.click();
      await expect(cart.contact.email).toHaveAttribute('aria-invalid', 'true');
    });
  }

  test('phone number length boundaries (9-11 digits)', { tag: [Tag.boundary] }, async ({ flightBooking, blocked }) => {
    await toCart(flightBooking, DataFactory.oneWayFlight(), blocked);
    const { contact } = flightBooking.cart;
    const errorShown = async (value: string) => {
      await contact.phone.fill(value);
      await contact.email.click();
      return flightBooking.cart.main.getByRole('alert').filter({ hasText: cartValidationMessages.invalidPhone }).isVisible();
    };
    expect(await errorShown(invalidContactInputs.phones.tooShort), '8 digits').toBe(true);
    expect(await errorShown(invalidContactInputs.validPhones.minLength), '9 digits').toBe(false);
    expect(await errorShown(invalidContactInputs.validPhones.maxLength), '11 digits').toBe(false);
    expect(await errorShown(invalidContactInputs.phones.tooLong), '12 digits').toBe(true);
  });

  test('valid canonical traveller data enables Proceed to Pay (payment not submitted)', { tag: [Tag.critical, Tag.positive] }, async ({ flightBooking, blocked }) => {
    await toCart(flightBooking, DataFactory.oneWayFlight(), blocked);
    const cart = flightBooking.cart;
    await cart.fillContact(primaryContact);
    await cart.fillTravellers([leadAdult]);
    await cart.acceptTerms();
    await expect(cart.alerts).toHaveCount(0);
    await expect(cart.proceedToPay).toBeEnabled({ timeout: 30_000 });
  });

  test('multi-passenger booking renders one traveller block per passenger with nationality (REG-004)', { tag: [Tag.positive] }, async ({ flightBooking, blocked }) => {
    const pax = { adults: 2, children: 1, infants: 1 };
    await toCart(flightBooking, DataFactory.oneWayFlight(pax), blocked);
    const cart = flightBooking.cart;
    const total = pax.adults + pax.children + pax.infants;
    expect(await cart.travellerCount()).toBe(total);
    await expect(cart.main.getByRole('button', { name: 'Nationality', exact: true })).toHaveCount(total);
  });

  test('canonical 2 adult / 1 child / 1 infant traveller data can be entered', { tag: [Tag.positive] }, async ({ flightBooking, blocked }) => {
    await toCart(flightBooking, DataFactory.oneWayFlight({ adults: 2, children: 1, infants: 1 }), blocked);
    const cart = flightBooking.cart;
    await cart.fillContact(primaryContact);
    await cart.fillTravellers([...passengerData.adults, ...passengerData.children, ...passengerData.infants]);
    await cart.acceptTerms();
    await expect(cart.proceedToPay).toBeEnabled({ timeout: 30_000 });
  });

  test('removing the flight empties the booking summary', { tag: [Tag.positive] }, async ({ flightBooking, blocked }) => {
    await toCart(flightBooking, DataFactory.oneWayFlight(), blocked);
    await flightBooking.cart.removeItem(0);
    await expect(flightBooking.cart.removeItemButtons).toHaveCount(0, { timeout: 30_000 });
  });
});
