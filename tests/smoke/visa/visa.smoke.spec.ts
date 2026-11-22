import { test, expect, Tag } from '../../../fixtures/test.fixture';
import { visaData, visaDestinationsInPriority } from '../../../data/visa/visa.data';

test.describe('Visa smoke', { tag: [Tag.smoke, Tag.visa] }, () => {
  test.beforeEach(async ({ visaHome }) => {
    await visaHome.openVisa();
  });

  test('visa module loads with eligibility form and visa types', { tag: [Tag.critical, Tag.positive] }, async ({ visaHome }) => {
    await expect(visaHome.heading).toBeVisible();
    await expect(visaHome.passportCountry.input).toBeEditable();
    await expect(visaHome.destination.input).toBeVisible();
    await expect(visaHome.checkRequirements).toBeEnabled();
    for (const type of ['eVisa', 'Sticker Visa', 'Visa Consultation'] as const) await expect(visaHome.visaTypeHeading(type)).toBeVisible();
  });

  test('traveller counter and passport country controls are functional', { tag: [Tag.positive] }, async ({ visaHome }) => {
    expect(await visaHome.travellerCount()).toBe(1);
    await visaHome.addTraveller.click();
    await expect.poll(() => visaHome.travellerCount()).toBe(2);
    await visaHome.removeTraveller.click();
    await expect.poll(() => visaHome.travellerCount()).toBe(1);
    const value = await visaHome.selectPassportCountry(visaData.passportCountry);
    // The field shows "<ISO code> - <country>" (e.g. "NG - Nigeria"); the country comes from the test data.
    expect(value).toMatch(new RegExp(String.raw`^[A-Z]{2} - ${visaData.passportCountry}$`, 'i'));
  });

  test('visa package selection is available for a configured destination', { tag: [Tag.critical] }, async ({ visaHome, blocked, observe }) => {
    await visaHome.selectPassportCountry(visaData.passportCountry);
    const resolution = await visaHome.resolveDestination(visaDestinationsInPriority);
    if (resolution.status === 'unavailable') {
      observe(`Destinations offered for ${visaData.passportCountry}: ${resolution.available.join(', ')}`);
      blocked(`None of the configured visa destinations (${resolution.attempted.join(' -> ')}) is offered on this environment; test data must be updated.`);
    }
    if (resolution.status !== 'resolved') return;
    if (resolution.usedFallback) observe(`Fallback destination used: ${resolution.destination}`);
    await visaHome.selectDestination(resolution.destination);
    await visaHome.checkRequirements.click();
    await expect(visaHome.page.getByRole('button', { name: /^Get Started/ })).toBeVisible({ timeout: 60_000 });
  });
});
