import { test, expect, Tag, credentialSafeArtifacts } from '../../../fixtures/test.fixture';
import { DataFactory } from '../../../utils/data.factory';
import { addonsToCart, completeStandardCart, payAndConfirm } from '../../../utils/flows';
import { IntegrityCheck, paymentChecks, dateVariants } from '../../../utils/confirmation';
import { timeouts } from '../../../config/test.config';

/**
 * Affiliate booking (user instruction 2026-11-15): a normal booking made while signed in as the affiliate.
 * Travel Add-ons is used because it offers the approved Pay at Bank route end to end.
 */
// Signed-in tests: no trace/video/screenshot, which could capture credentials (see CLAUDE.md).
test.use(credentialSafeArtifacts);

test.describe('Affiliate E2E', { tag: [Tag.e2e, Tag.affiliate, Tag.confirmation] }, () => {
  test.describe.configure({ timeout: timeouts.bookingFlow });

  test('signed-in affiliate books Travel Add-ons with Pay at Bank; session kept and booking attributed', { tag: [Tag.critical] }, async ({ page, signedInAffiliate, affiliateSession, requireBookingSubmission, observe, blocked }, testInfo) => {
    void signedInAffiliate; void requireBookingSubmission;
    expect(await affiliateSession.sessionStored(), 'affiliate session before booking').toBe(true);
    const offset = DataFactory.e2eOffsetDays();
    const { cart, panelTotal, departureDate } = await addonsToCart(page, offset, 1);
    expect(await affiliateSession.sessionStored(), 'affiliate session kept into the cart').toBe(true);
    await completeStandardCart(cart, { addonTravel: true });

    // Capture the booking record the confirmation page loads, to look for affiliate attribution.
    let bookingJson = '';
    page.on('response', async (r) => {
      if (/\/api\/booking\/(Booking\/Booking|BookingConfirmation\/Get)\/\d+/.test(r.url())) bookingJson += await r.text().catch(() => '');
    });
    const pay = await payAndConfirm(cart, testInfo, blocked);
    const conf = pay.confirmation!;
    expect(await affiliateSession.sessionStored(), 'affiliate session kept through confirmation').toBe(true);

    const affiliateKeys = [...new Set([...bookingJson.matchAll(/"([A-Za-z]*(?:[Aa]ffiliate|[Aa]gent)[A-Za-z]*)"\s*:\s*("[^"]*"|null|\d+|true|false)/g)].map((m) => `${m[1]}=${m[2] === 'null' || m[2] === '""' ? 'empty' : 'set'}`))];
    observe(`Affiliate-related fields in booking API: ${affiliateKeys.join(', ') || 'none found'}`);

    const check = new IntegrityCheck('Affiliate booking confirmation');
    check
      .equal('Booking reference', pay.bookingId, conf.bookingId)
      .equal('Payment status', 'PENDING PAYMENT', conf.paymentStatus)
      .equal('Amount payable', panelTotal, conf.amountPayable ?? '')
      .containsAny('Travel date', dateVariants(departureDate), conf.text)
      .equal('Affiliate attribution recorded on the booking', 'set', affiliateKeys.some((k) => k.endsWith('=set')) ? 'set' : 'not found', 'booking/confirmation API fields');
    paymentChecks(check, pay);
    await check.assert(testInfo);
  });
});
