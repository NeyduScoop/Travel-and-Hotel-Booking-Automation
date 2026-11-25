import { test, expect, Tag } from '../../../fixtures/test.fixture';
import { visaData, visaDestinationsInPriority } from '../../../data/visa/visa.data';
import { leadAdult, primaryContact } from '../../../data/common/passengers.data';
import { nairaAfter } from '../../../utils/confirmation';
import type { VisaHomePage } from '../../../pages/visa/VisaHomePage';

/** Resolve the configured destination (primary -> fallbacks) or mark the test BLOCKED. */
async function selectConfiguredDestination(
  visaHome: VisaHomePage,
  blocked: (r: string) => never,
  observe: (d: string) => void,
): Promise<string> {
  await visaHome.selectPassportCountry(visaData.passportCountry);
  const resolution = await visaHome.resolveDestination(visaDestinationsInPriority);
  if (resolution.status === 'unavailable') {
    blocked(`Configured visa destinations (${resolution.attempted.join(' -> ')}) are not offered for a ${visaData.passportCountry} passport on this environment.`);
  }
  if (resolution.status !== 'resolved') throw new Error('unreachable');
  observe(`Visa destinations attempted: ${resolution.attempted.join(' -> ')}${resolution.usedFallback ? ' (fallback used)' : ''}`);
  await visaHome.selectDestination(resolution.destination);
  return resolution.destination;
}

test.describe('Visa regression', { tag: [Tag.regression, Tag.visa] }, () => {
  test.beforeEach(async ({ visaHome }) => {
    await visaHome.openVisa();
  });

  test('traveller count cannot go below one', { tag: [Tag.boundary] }, async ({ visaHome }) => {
    expect(await visaHome.travellerCount()).toBe(1);
    await expect(visaHome.removeTraveller).toBeDisabled();
    await visaHome.addTraveller.click();
    await expect(visaHome.removeTraveller).toBeEnabled();
  });

  test('passport country search filters to the configured country', { tag: [Tag.positive] }, async ({ visaHome }) => {
    const suggestions = await visaHome.passportCountry.suggestionsFor(visaData.passportCountry.slice(0, 3));
    expect(suggestions.some((s) => s.includes(visaData.passportCountry))).toBe(true);
  });

  test('destination list is populated for the passport country', { tag: [Tag.positive] }, async ({ visaHome, observe }) => {
    await visaHome.selectPassportCountry(visaData.passportCountry);
    const destinations = await visaHome.availableDestinations();
    observe(`${destinations.length} destinations offered: ${destinations.join(', ')}`);
    expect(destinations.length).toBeGreaterThan(0);
  });

  test('an unknown destination returns no suggestions', { tag: [Tag.negative] }, async ({ visaHome }) => {
    await visaHome.selectPassportCountry(visaData.passportCountry);
    expect(await visaHome.destination.suggestionsFor('Atlantis')).toEqual([]);
  });

  test('requirements are not shown without a destination', { tag: [Tag.negative] }, async ({ visaHome, visaPackage }) => {
    await visaHome.selectPassportCountry(visaData.passportCountry);
    await visaHome.checkRequirements.click();
    await expect(visaPackage.getStarted).toBeHidden();
  });

  test('configured destination shows requirements, documents and order summary', { tag: [Tag.critical, Tag.positive] }, async ({ visaHome, visaPackage, blocked, observe }) => {
    const destination = await selectConfiguredDestination(visaHome, blocked, observe);
    await visaHome.checkRequirements.click();
    await visaPackage.waitForRequirements(destination);
    await expect(visaPackage.requiredDocumentsHeading).toBeVisible();
    await expect(visaPackage.contactHeading).toBeVisible();
  });

  test('order summary total equals the Get Started amount', { tag: [Tag.positive] }, async ({ visaHome, visaPackage, blocked, observe }) => {
    const destination = await selectConfiguredDestination(visaHome, blocked, observe);
    await visaHome.checkRequirements.click();
    await visaPackage.waitForRequirements(destination);
    const { total, cta } = await visaPackage.lineAmounts();
    expect(cta).toBe(total);
  });

  test('removing the consultation reduces the total by the consultation fee', { tag: [Tag.positive] }, async ({ visaHome, visaPackage, blocked, observe }) => {
    const destination = await selectConfiguredDestination(visaHome, blocked, observe);
    await visaHome.checkRequirements.click();
    await visaPackage.waitForRequirements(destination);
    if (!(await visaPackage.removeConsultation.isVisible())) blocked('No consultation is pre-added for this destination.');
    const before = await visaPackage.lineAmounts();
    const fee = Number(/Visa Consultation\s*₦([\d,]+)/.exec(before.text)?.[1].replace(/,/g, ''));
    await visaPackage.removeConsultation.click();
    await expect.poll(async () => (await visaPackage.lineAmounts()).total).toBe(before.total - fee);
  });
  // Screens after "Get Started" (inspected 2026-11-23). Stops before "Proceed to payment", which creates a booking.
  test('application: applicant step prefills passport nationality and contact, review requires Terms', { tag: [Tag.critical, Tag.positive] }, async ({ visaHome, visaPackage, visaApplication, blocked, observe }) => {
    const destination = await selectConfiguredDestination(visaHome, blocked, observe);
    await visaHome.checkRequirements.click();
    await visaPackage.waitForRequirements(destination);
    const { total } = await visaPackage.lineAmounts();
    await visaPackage.contactEmail.fill(primaryContact.email);
    await visaPackage.contactPhone.fill(primaryContact.phone);
    await visaPackage.getStarted.click();
    await visaApplication.waitForTravellerStep();
    await expect(visaApplication.nationality()).toHaveText(new RegExp(visaData.passportCountry, 'i'));
    await expect(visaApplication.email()).toHaveValue(primaryContact.email);
    await expect(visaApplication.sidebar).toContainText(destination);
    await visaApplication.fillTraveller(leadAdult);
    await visaApplication.continueToReview();
    await expect(visaApplication.proceedButton).toBeDisabled();
    await visaApplication.acceptTerms();
    await expect(visaApplication.proceedButton).toBeEnabled();
    const sidebar = (await visaApplication.sidebar.innerText()).replace(/\s+/g, ' ');
    expect(nairaAfter(sidebar, 'Total'), 'application total = requirements total').toBe(total);
  });
});
