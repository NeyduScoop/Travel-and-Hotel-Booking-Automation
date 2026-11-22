import { test, expect, Tag } from '../../../fixtures/test.fixture';
import { DataFactory } from '../../../utils/data.factory';
import { addonsToCart, completeStandardCart, flightToCart, priceIntegrity, tourToCart } from '../../../utils/flows';
import { PAYMENT_METHODS } from '../../../components/payment/PaymentSection';
import { timeouts } from '../../../config/test.config';
import type { CartPage } from '../../../pages/common/CartPage';

/**
 * Phase 5: booking summary, add-ons and payment-step validation.
 * Tests that press "Proceed to Pay" create (unpaid) booking records and therefore require
 * ALLOW_TEST_BOOKING_SUBMISSION=true; no payment is submitted here.
 */

async function assertPaymentStep(cart: CartPage, label: string, observe: (d: string) => void) {
  const options = await cart.payment.available();
  observe(`${label} payment options: ${options.join(' | ')}`);
  expect(options.length, `${label}: payment options are displayed`).toBeGreaterThan(0);
  expect(await cart.payment.checked(), `${label}: no payment option is pre-selected`).toEqual([]);
  for (const option of options) {
    if (/kalabash/i.test(option)) continue; // never selected (user instruction); labelled differently per product
    await expect(cart.payment.option(option)).toBeEnabled();
    await cart.payment.select(option);
    expect(await cart.payment.checked(), `${label}: "${option}" is the only selected method`).toEqual([option]);
  }
  const breakdown = await cart.priceBreakdown.read();
  const payCard = await cart.payment.payCardAmount();
  const makePayment = await cart.payment.makePaymentAmount();
  expect(payCard, `${label}: payment card total = booking summary total`).toBe(breakdown.grandTotal);
  expect(makePayment, `${label}: "Make Payment" amount = booking summary total`).toBe(breakdown.grandTotal);
  const { expected, displayed } = priceIntegrity(breakdown);
  expect(displayed, `${label}: displayed total equals independently summed line items + add-ons (${breakdown.text.slice(0, 300)})`).toBe(expected);
}

test.describe('Payment step and booking summary', { tag: [Tag.regression, Tag.payment] }, () => {
  test.describe.configure({ timeout: timeouts.bookingFlow });

  test('Travel Add-ons: payment options, selection and summary = payment card total', { tag: [Tag.addons, Tag.critical] }, async ({ page, requireBookingSubmission, observe }) => {
    void requireBookingSubmission;
    const { cart, panelTotal } = await addonsToCart(page, DataFactory.e2eOffsetDays());
    await completeStandardCart(cart, { addonTravel: true });
    await cart.proceedToPayment();
    expect((await cart.priceBreakdown.read()).grandTotal, 'cart total = selection panel total').toBe(panelTotal);
    expect(await cart.payment.available()).toContain(PAYMENT_METHODS.payAtBank);
    await assertPaymentStep(cart, 'Travel Add-ons', observe);
  });

  test('Flights: payment options, selection and summary = payment card total', { tag: [Tag.flights, Tag.critical] }, async ({ page, requireBookingSubmission, observe, blocked }) => {
    void requireBookingSubmission;
    const { cart } = await flightToCart(page, DataFactory.oneWayFlight(undefined, 'Economy', DataFactory.e2eOffsetDays()), blocked);
    await completeStandardCart(cart);
    await cart.proceedToPayment();
    await assertPaymentStep(cart, 'Flights', observe);
  });

  test('Flights: price confirmed at the cart is the price charged at the payment step', { tag: [Tag.flights, Tag.critical, Tag.negative] }, async ({ page, requireBookingSubmission, blocked }) => {
    void requireBookingSubmission;
    const { cart, summary } = await flightToCart(page, DataFactory.oneWayFlight(undefined, 'Economy', DataFactory.e2eOffsetDays()), blocked);
    await completeStandardCart(cart);
    const cartBreakdown = await cart.priceBreakdown.readWithLines();
    const cartAddons = cartBreakdown.addons.reduce((a, x) => a + x.amount, 0);
    await cart.proceedToPayment();
    const pay = await cart.priceBreakdown.read();
    const payAddons = pay.addons.reduce((a, x) => a + x.amount, 0);
    expect(pay.grandTotal - payAddons, `fare charged at payment vs listing ₦${summary.price} / cart (${cartBreakdown.text.slice(0, 200)}) / payment (${pay.text.slice(0, 260)})`).toBe(cartBreakdown.grandTotal - cartAddons);
  });

  test('Tours: payment options, selection and summary = payment card total', { tag: [Tag.tours] }, async ({ page, requireBookingSubmission, observe, blocked }) => {
    void requireBookingSubmission;
    const { cart } = await tourToCart(page, DataFactory.tourSearch({ startDate: DataFactory.tourSearch().startDate }), blocked);
    await completeStandardCart(cart, { tourQuestions: true });
    await cart.proceedToPayment();
    await assertPaymentStep(cart, 'Tours', observe);
  });

  test('Flights cart: adding and removing an add-on updates the total and the summary list', { tag: [Tag.flights, Tag.critical] }, async ({ page, requireCartCreation, blocked }) => {
    void requireCartCreation;
    const { cart } = await flightToCart(page, DataFactory.oneWayFlight(), blocked);
    await completeStandardCart(cart);
    const addons = await cart.tripAddons.list();
    expect(addons.length, 'Enhance Your Trip offers add-ons').toBeGreaterThan(0);
    const target = addons.find((a) => !a.selected);
    if (!target) blocked('Every add-on is already selected.');
    const before = await cart.priceBreakdown.read();
    await cart.tripAddons.add(target!.name);
    await expect.poll(async () => (await cart.priceBreakdown.read()).grandTotal, { timeout: 20_000 }).toBe(before.grandTotal + target!.price);
    const after = await cart.priceBreakdown.read();
    expect(after.addons.map((a) => a.name)).toContain(target!.name);
    expect(after.addons.find((a) => a.name === target!.name)?.amount).toBe(target!.price);
    // The summary lists exactly the add-ons marked selected in "Enhance Your Trip".
    const selected = (await cart.tripAddons.list()).filter((a) => a.selected).map((a) => a.name).sort();
    expect(after.addons.map((a) => a.name).sort()).toEqual(selected);
    await cart.tripAddons.remove(target!.name);
    await expect.poll(async () => (await cart.priceBreakdown.read()).grandTotal, { timeout: 20_000 }).toBe(before.grandTotal);
    expect((await cart.priceBreakdown.read()).addons.map((a) => a.name)).not.toContain(target!.name);
  });

  test('Flights cart: add-ons are not pre-selected without the customer opting in', { tag: [Tag.flights, Tag.negative] }, async ({ page, requireCartCreation, observe, blocked }) => {
    void requireCartCreation;
    const { cart } = await flightToCart(page, DataFactory.oneWayFlight(), blocked);
    await completeStandardCart(cart);
    const preselected = (await cart.tripAddons.list()).filter((a) => a.selected);
    observe(`Pre-selected paid add-ons: ${preselected.map((a) => `${a.name} ₦${a.price}`).join(', ') || 'none'}`);
    expect(preselected.map((a) => a.name), 'paid add-ons must be opt-in ("All add-ons are optional")').toEqual([]);
  });
});
