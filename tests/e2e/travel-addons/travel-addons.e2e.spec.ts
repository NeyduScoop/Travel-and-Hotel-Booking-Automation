import { test, expect, Tag } from '../../../fixtures/test.fixture';
import { DataFactory } from '../../../utils/data.factory';
import { addonsToCart, completeStandardCart, payAndConfirm, priceIntegrity } from '../../../utils/flows';
import { IntegrityCheck, paymentChecks, dateVariants, naira } from '../../../utils/confirmation';
import { addonData } from '../../../data/travel-addons/addons.data';
import { leadAdult, primaryContact } from '../../../data/common/passengers.data';
import { timeouts } from '../../../config/test.config';

test.describe('Travel Add-ons E2E', { tag: [Tag.e2e, Tag.addons, Tag.confirmation] }, () => {
  test.describe.configure({ timeout: timeouts.bookingFlow });

  test('search → select two add-ons → cart → PAX (PNR, time of travel) → Pay at Bank → confirmation', { tag: [Tag.critical] }, async ({ page, requireBookingSubmission, blocked }, testInfo) => {
    void requireBookingSubmission;
    const offset = DataFactory.e2eOffsetDays();
    const { cart, picked, panelTotal, departureDate } = await addonsToCart(page, offset, 2);
    const travellers = await completeStandardCart(cart, { addonTravel: true });
    const pay = await payAndConfirm(cart, testInfo, blocked);
    expect(pay.route).toBe('PAY_AT_BANK');
    const conf = pay.confirmation!;
    const check = new IntegrityCheck('Travel Add-ons confirmation');
    check
      .equal('Booking reference', pay.bookingId, conf.bookingId, 'booking id from Payment/Get vs confirmation')
      .equal('Booking ref = Booking ID', conf.bookingId, conf.bookingRef)
      .equal('Payment status (Pay at Bank is unpaid)', 'PENDING PAYMENT', conf.paymentStatus)
      .equal('Amount payable', panelTotal, conf.amountPayable ?? '', 'selection panel total')
      .contains('Departure', 'Lagos', conf.text)
      .containsAny('Travel date', dateVariants(departureDate), conf.text);
    for (const a of picked) check.contains(`Add-on "${a.name}"`, a.name, conf.text);
    for (const a of picked) check.contains(`Add-on price "${a.name}"`, naira(a.unitPrice), conf.text);
    check
      .contains('Passenger name', `${travellers[0].title} ${travellers[0].lastName}, ${travellers[0].firstName}`, conf.text)
      .contains('Email', primaryContact.email, conf.text)
      .contains('Phone (international format)', `+234${primaryContact.phone.replace(/^0/, '')}`, conf.text, 'calling code +234 followed by the number without its trunk 0')
      .contains('Passport number', leadAdult.passportNumber, conf.text)
      .contains('PNR', addonData.PNR, conf.text, 'entered on the PAX page')
      .contains('Time of travel', addonData.timeOfTravel.replace(/^12:00 AM$/, '00:00'), conf.text, 'entered on the PAX page')
      .contains('Currency', '₦', conf.text);
    const integrity = priceIntegrity(pay.breakdown);
    check.equal('Summary total = Σ line items', integrity.expected, integrity.displayed);
    paymentChecks(check, pay);
    await check.assert(testInfo);
  });
});
