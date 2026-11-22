import { test, expect, Tag } from '../../../fixtures/test.fixture';
import { DataFactory } from '../../../utils/data.factory';
import { completeStandardCart, payAndConfirm, priceIntegrity, tourToCart } from '../../../utils/flows';
import { IntegrityCheck, paymentChecks, dateVariants, naira } from '../../../utils/confirmation';
import { futureDate, addDays } from '../../../utils/date.utils';
import { timeouts } from '../../../config/test.config';

test.describe('Tours E2E', { tag: [Tag.e2e, Tag.tours, Tag.confirmation] }, () => {
  test.describe.configure({ timeout: timeouts.bookingFlow * 2 });

  test('Configured destination: search → tour → option → PAX + supplier questions → pay → confirmation', { tag: [Tag.critical] }, async ({ page, requireBookingSubmission, blocked }, testInfo) => {
    void requireBookingSubmission;
    const start = futureDate(DataFactory.e2eOffsetDays());
    const criteria = DataFactory.tourSearch({ startDate: start, endDate: addDays(start, 5) });
    const { cart, tour, option, perAdult, total } = await tourToCart(page, criteria, blocked);
    expect(total, 'tour total = per-adult × travellers').toBe(perAdult * criteria.adults);
    const filled = await completeStandardCart(cart, { tourQuestions: true });
    const pay = await payAndConfirm(cart, testInfo, blocked);
    const conf = pay.confirmation!;
    const check = new IntegrityCheck('Tour confirmation');
    check
      .equal('Booking reference', pay.bookingId, conf.bookingId)
      .contains('Tour', tour, conf.text)
      .contains('Destination', criteria.destination, conf.text)
      .containsAny('Tour date', dateVariants(criteria.startDate), conf.text)
      .contains('Tour option', option.split(' – ')[0].split(',')[0].trim(), conf.text)
      .contains('Travellers', `${criteria.adults}`, conf.text)
      .contains('Tour price', naira(total), conf.text);
    for (const t of filled) check.contains(`Traveller ${t.firstName}`, t.lastName, conf.text);
    const integrity = priceIntegrity(pay.breakdown);
    check.equal('Summary total = Σ line items', integrity.expected, integrity.displayed);
    paymentChecks(check, pay);
    await check.assert(testInfo);
  });
});
