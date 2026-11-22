import { test, expect, Tag } from '../../../fixtures/test.fixture';
import { visaData, visaDestinationsInPriority } from '../../../data/visa/visa.data';
import { timeouts } from '../../../config/test.config';

/**
 * Visa E2E (Project.md §13): Check Requirements → Contact details → Get Started → Applicant → Terms →
 * Payment → Confirmation. The steps after "Get Started" are only reachable with a configured
 * destination; on DEVTEST none of the configured destinations is offered, so this flow reports
 * BLOCKED (TEST DATA ISSUE) and its later steps are deliberately not modelled with guessed selectors.
 */
test.describe('Visa E2E', { tag: [Tag.e2e, Tag.visa, Tag.confirmation] }, () => {
  test.describe.configure({ timeout: timeouts.bookingFlow });

  test('configured destination: requirements → contact → Get Started → applicant → payment → confirmation', { tag: [Tag.critical] }, async ({ visaHome, visaPackage, requireBookingSubmission, observe, blocked }) => {
    void requireBookingSubmission;
    await visaHome.openVisa();
    await visaHome.selectPassportCountry(visaData.passportCountry);
    const resolution = await visaHome.resolveDestination(visaDestinationsInPriority);
    if (resolution.status === 'unavailable') {
      observe(`Destinations offered: ${resolution.available.join(', ')}`);
      blocked(`TEST DATA ISSUE: none of the configured visa destinations (${resolution.attempted.join(' -> ')}) is offered for a ${visaData.passportCountry} passport; the applicant, document upload, declaration, payment and confirmation steps cannot be reached.`);
    }
    if (resolution.status !== 'resolved') return;
    await visaHome.selectDestination(resolution.destination);
    await visaHome.checkRequirements.click();
    await visaPackage.waitForRequirements(resolution.destination);
    await expect(visaPackage.getStarted).toBeVisible();
    blocked('NEEDS CLARIFICATION: the post-"Get Started" visa screens have not been observed yet; they must be inspected before automating them.');
  });
});
