import { test, expect, Tag } from '../../../fixtures/test.fixture';
import { visaData, visaDestinationsInPriority } from '../../../data/visa/visa.data';
import { leadAdult, primaryContact } from '../../../data/common/passengers.data';
import { payAndConfirm } from '../../../utils/flows';
import { IntegrityCheck, paymentChecks, dateVariants, nairaAfter } from '../../../utils/confirmation';
import { parseIsoDate } from '../../../utils/date.utils';
import { timeouts } from '../../../config/test.config';

/**
 * Visa E2E (Project.md §13), screens inspected on DEVTEST 2026-11-23 (Ghana passport → France):
 * requirements → contact details → Get Started → "Who's travelling?" (applicant) → Continue → "Review & pay"
 * (plan, Terms) → Proceed to payment (creates the booking) → payment route (owner rule) → /summary/<id>.
 * One applicant: the canonical lead adult. The nationality is the one the form prefills from the selected
 * passport country (the visa applicant's passport), not the flight passenger's nationality.
 */
test.describe('Visa E2E', { tag: [Tag.e2e, Tag.visa, Tag.confirmation] }, () => {
  test.describe.configure({ timeout: timeouts.bookingFlow });

  test('configured destination: requirements → contact → Get Started → applicant → review → pay → confirmation', { tag: [Tag.critical] }, async ({ visaHome, visaPackage, visaApplication, requireBookingSubmission, observe, blocked }, testInfo) => {
    void requireBookingSubmission;
    await visaHome.openVisa();
    await visaHome.selectPassportCountry(visaData.passportCountry);
    const resolution = await visaHome.resolveDestination(visaDestinationsInPriority);
    if (resolution.status === 'unavailable') {
      observe(`Destinations offered: ${resolution.available.join(', ')}`);
      blocked(`TEST DATA ISSUE: none of the configured visa destinations (${resolution.attempted.join(' -> ')}) is offered for a ${visaData.passportCountry} passport.`);
    }
    if (resolution.status !== 'resolved') return;
    const destination = resolution.destination;
    observe(`Visa destination: ${destination}${resolution.usedFallback ? ' (fallback)' : ''}; attempted ${resolution.attempted.join(' -> ')}`);
    await visaHome.selectDestination(destination);
    await visaHome.checkRequirements.click();
    await visaPackage.waitForRequirements(destination);
    const requirements = await visaPackage.lineAmounts();
    expect(requirements.cta, 'Get Started amount = order summary total').toBe(requirements.total);

    // Contact details, then Get Started.
    await visaPackage.contactEmail.fill(primaryContact.email);
    await visaPackage.contactPhone.fill(primaryContact.phone);
    await visaPackage.getStarted.click();

    // Step 1: applicant.
    await visaApplication.waitForTravellerStep();
    await expect(visaApplication.nationality(), 'nationality prefilled with the passport country').toHaveText(new RegExp(visaData.passportCountry, 'i'));
    await expect(visaApplication.email(), 'email carried from the contact details').toHaveValue(primaryContact.email);
    await visaApplication.fillTraveller(leadAdult);
    await visaApplication.continueToReview();

    // Step 2: review & pay.
    const plan = await visaApplication.planPricePerAdult();
    await expect(visaApplication.proceedButton, '"Proceed to payment" disabled until Terms are accepted').toBeDisabled();
    await visaApplication.acceptTerms();
    const sidebar = (await visaApplication.sidebar.innerText()).replace(/\s+/g, ' ');
    const sidebarTotal = nairaAfter(sidebar, 'Total');
    const consultation = nairaAfter(sidebar, 'Visa Consultation') ?? 0;

    const pay = await payAndConfirm(visaApplication, testInfo, blocked);
    const conf = pay.confirmation!;
    const check = new IntegrityCheck('Visa confirmation');
    check
      .equal('Booking reference', pay.bookingId, conf.bookingId)
      .equal('Sidebar total = plan × 1 applicant + consultation', plan + consultation, sidebarTotal ?? '')
      .equal('Requirements total = application total', requirements.total, sidebarTotal ?? '')
      .contains('Destination', destination, conf.text)
      .contains('Product', 'Your Visa Application', conf.text)
      .contains('Applicant first name', leadAdult.firstName, conf.text)
      .contains('Applicant last name', leadAdult.lastName, conf.text)
      .contains('Nationality (passport country)', visaData.passportCountry, conf.text)
      .contains('Gender', leadAdult.gender, conf.text)
      .containsAny('Date of birth', dateVariants(parseIsoDate(leadAdult.dateOfBirth)), conf.text)
      .contains('Passport number', leadAdult.passportNumber, conf.text)
      .contains('Phone (international format)', `+234${primaryContact.phone.replace(/^0/, '')}`, conf.text, 'calling code +234 followed by the number without its trunk 0')
      .equal('Visa Fee on the summary = plan price', plan, nairaAfter(conf.text, 'Visa Fee') ?? '')
      .equal('Grand Total on the summary = application total', sidebarTotal ?? NaN, nairaAfter(conf.text, 'Grand Total') ?? '');
    paymentChecks(check, pay);
    await check.assert(testInfo);
  });
});
