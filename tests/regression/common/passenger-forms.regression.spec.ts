import * as fs from 'fs';
import * as path from 'path';
import { test, expect, Tag } from '../../../fixtures/test.fixture';
import { DataFactory } from '../../../utils/data.factory';
import { addonsToCart, completeStandardCart, flightToCart, tourToCart } from '../../../utils/flows';
import { primaryContact, leadAdult } from '../../../data/common/passengers.data';
import { addonData } from '../../../data/travel-addons/addons.data';
import { tourSupplierAnswers } from '../../../data/tours/tour-booking.data';
import { timeouts } from '../../../config/test.config';
import { shortMonth, parseIsoDate } from '../../../utils/date.utils';
import type { CartPage } from '../../../pages/common/CartPage';
import { readEnv } from '../../../utils/environment.utils';

/**
 * Passport image for the OCR test. Default: the committed SYNTHETIC specimen (scripts/generate-passport-specimen.ts),
 * built from the fictional canonical lead adult, so CI needs no real ID. A private image can be used instead by
 * setting PASSPORT_IMAGE_PATH and PASSPORT_EXPECTED_PATH (JSON: surname, givenNames, passportNumber, dateOfBirth,
 * gender, nationality), e.g. the git-ignored data/common/passport-images/ files locally.
 */
function passportUnderTest(): { image: string; expected: Record<string, string>; source: string } | undefined {
  const image = readEnv('PASSPORT_IMAGE_PATH');
  const expectedPath = readEnv('PASSPORT_EXPECTED_PATH');
  if (image && expectedPath) {
    if (!fs.existsSync(image) || !fs.existsSync(expectedPath)) return undefined;
    return { image, expected: JSON.parse(fs.readFileSync(expectedPath, 'utf8')) as Record<string, string>, source: 'private image (PASSPORT_IMAGE_PATH)' };
  }
  const specimen = path.resolve(__dirname, '../../../data/common/passport-specimen/specimen-passport.jpg');
  if (!fs.existsSync(specimen)) return undefined;
  return {
    image: specimen,
    expected: { surname: leadAdult.lastName, givenNames: leadAdult.firstName, passportNumber: leadAdult.passportNumber, dateOfBirth: leadAdult.dateOfBirth, gender: leadAdult.gender, nationality: leadAdult.nationality },
    source: 'synthetic specimen',
  };
}

/**
 * Select every offered title in turn and verify each is retained; returns the offered list.
 * The caller waits for the PAX page first (cart.waitForTravellerForms); each selection opens the dropdown,
 * waits for its options, picks the title and verifies the exact value shown.
 */
async function exerciseTitles(cart: CartPage, index: number): Promise<string[]> {
  const form = cart.traveller(index);
  const options = await form.titleOptions();
  for (const title of options) {
    await form.selectTitle(title);
    expect(await form.selectedTitle(), `traveller ${index + 1} title retained`).toBe(title);
  }
  return options;
}

test.describe('Passenger page and form validation', { tag: [Tag.regression] }, () => {
  test.describe.configure({ timeout: timeouts.bookingFlow });

  test('Flights: title options per traveller type are all selectable and retained', { tag: [Tag.flights, Tag.positive] }, async ({ page, requireCartCreation, observe, blocked }) => {
    void requireCartCreation;
    const { cart } = await flightToCart(page, DataFactory.oneWayFlight({ adults: 1, children: 1, infants: 1 }), blocked);
    await cart.waitForTravellerForms(3);
    const adult = await exerciseTitles(cart, 0);
    const child = await exerciseTitles(cart, 1);
    const infant = await exerciseTitles(cart, 2);
    observe(`Flight titles — adult: ${adult.join(', ')} | child: ${child.join(', ')} | infant: ${infant.join(', ')}`);
    expect(adult.length).toBeGreaterThan(0);
    expect(child.length).toBeGreaterThan(0);
    expect(infant.length).toBeGreaterThan(0);
  });

  test('Travel Add-ons: title options are all selectable and retained', { tag: [Tag.addons, Tag.positive] }, async ({ page, requireCartCreation, observe }) => {
    void requireCartCreation;
    const { cart } = await addonsToCart(page, 30, 1);
    await cart.waitForTravellerForms(1);
    const titles = await exerciseTitles(cart, 0);
    observe(`Travel Add-ons titles: ${titles.join(', ')}`);
    expect(titles.length).toBeGreaterThan(0);
  });

  test('Tours: title options are all selectable and retained', { tag: [Tag.tours, Tag.positive] }, async ({ page, requireCartCreation, observe, blocked }) => {
    void requireCartCreation;
    const { cart } = await tourToCart(page, DataFactory.tourSearch(), blocked);
    await cart.waitForTravellerForms();
    const titles = await exerciseTitles(cart, 0);
    observe(`Tours titles: ${titles.join(', ')}`);
    expect(titles.length).toBeGreaterThan(0);
  });

  for (const product of ['Flights', 'Travel Add-ons', 'Tours'] as const) {
    test(`${product}: Terms and Conditions must be accepted before payment`, { tag: [Tag.critical, Tag.negative] }, async ({ page, requireCartCreation, blocked }) => {
      void requireCartCreation;
      const cart =
        product === 'Flights' ? (await flightToCart(page, DataFactory.oneWayFlight(), blocked)).cart
        : product === 'Tours' ? (await tourToCart(page, DataFactory.tourSearch(), blocked)).cart
        : (await addonsToCart(page, 30, 1)).cart;
      await cart.waitForTravellerForms();
      await completeStandardCart(cart, { addonTravel: product === 'Travel Add-ons', tourQuestions: product === 'Tours' });
      await cart.termsCheckbox.uncheck();
      await expect(cart.termsCheckbox).not.toBeChecked();
      await expect(cart.proceedToPay, 'Proceed to Pay stays disabled without Terms').toBeDisabled();
      await cart.acceptTerms();
      await expect(cart.proceedToPay, 'Proceed to Pay enabled once Terms are accepted and all fields are valid').toBeEnabled({ timeout: 30_000 });
    });
  }

  test('Travel Add-ons: PNR, time of travel and middle name accept valid input', { tag: [Tag.addons, Tag.positive] }, async ({ page, requireCartCreation }) => {
    void requireCartCreation;
    const { cart } = await addonsToCart(page, 30, 1);
    await cart.pnr.fill(addonData.PNR);
    await expect(cart.pnr).toHaveValue(addonData.PNR);
    const t = await cart.setTimeOfTravel(addonData.timeOfTravel);
    await expect(cart.timeOfTravel).toHaveValue(t);
    await cart.traveller(0).middleName.fill('Tester');
    await expect(cart.traveller(0).middleName).toHaveValue('Tester');
  });

  // Owner direction (2026-11-24): the configured time (TIME_OF_TRAVEL in .env / CI variable, else test data) is
  // selected. Whether Proceed was already enabled without a time is recorded as an observation (D-14).
  test('Travel Add-ons: time of travel is required', { tag: [Tag.addons, Tag.negative] }, async ({ page, requireCartCreation, observe }) => {
    void requireCartCreation;
    const { cart } = await addonsToCart(page, 30, 1);
    await cart.waitForTravellerForms(1);
    await cart.fillContact(primaryContact);
    await cart.fillTravellers([leadAdult]);
    await cart.countryOfArrival.select(leadAdult.nationality);
    await cart.acceptTerms();
    await expect(cart.timeOfTravel).toHaveValue('');
    const enabledWithoutTime = await cart.proceedToPay.isEnabled();
    observe(`D-14 check: Proceed to Pay ${enabledWithoutTime ? 'ENABLED' : 'disabled'} while "Time of travel" is empty`);
    const value = await cart.setTimeOfTravel(addonData.timeOfTravel);
    await expect(cart.timeOfTravel, `configured time of travel "${addonData.timeOfTravel}"`).toHaveValue(value);
    await expect(cart.proceedToPay, 'Proceed to Pay enabled once the time of travel is set').toBeEnabled({ timeout: 30_000 });
  });

  test('Tours: supplier questions are required before payment', { tag: [Tag.tours, Tag.negative] }, async ({ page, requireCartCreation, observe, blocked }) => {
    void requireCartCreation;
    const { cart } = await tourToCart(page, DataFactory.tourSearch(), blocked);
    const keys = await cart.supplierQuestionKeys();
    observe(`Tour supplier question keys: ${keys.join(', ')}`);
    await cart.fillContact(primaryContact);
    await cart.fillTravellers(DataFactory.travellersFor({ adults: await cart.travellerCount(), children: 0, infants: 0 }));
    await cart.acceptTerms();
    if (keys.length) await expect(cart.proceedToPay, 'supplier questions unanswered').toBeDisabled();
    await cart.answerSupplierQuestions(tourSupplierAnswers);
    await expect(cart.proceedToPay).toBeEnabled({ timeout: 30_000 });
  });

  test('Tours: supplier questions are presented in English', { tag: [Tag.tours, Tag.negative] }, async ({ page, requireCartCreation, blocked }) => {
    void requireCartCreation;
    const { cart } = await tourToCart(page, DataFactory.tourSearch(), blocked);
    const labels = await cart.supplierQuestions.allInnerTexts();
    if (!labels.length) blocked('This tour has no supplier questions.');
    for (const l of labels) expect(l, 'supplier question language').not.toMatch(/\b(Si prega|vostro|dell'hotel|proprio)\b/i);
  });

  test('Passport upload: image is accepted and OCR populates the traveller fields', { tag: [Tag.addons, Tag.critical] }, async ({ page, requireCartCreation, observe, blocked }) => {
    void requireCartCreation;
    const passport = passportUnderTest();
    if (!passport) blocked('MISSING TEST ASSET: neither the synthetic specimen nor PASSPORT_IMAGE_PATH / PASSPORT_EXPECTED_PATH files are present.');
    const { image, expected, source } = passport!;
    observe(`Passport image: ${source}`);
    const { cart } = await addonsToCart(page, 30, 1);
    await cart.waitForTravellerForms(1);
    const form = cart.traveller(0);
    await expect(page.getByText('Upload passport to auto-fill').first()).toBeVisible();
    const started = Date.now();
    await form.passportUpload.setInputFiles(image);
    await expect.poll(async () => (await form.surname.inputValue()).length, { timeout: 90_000, message: 'OCR should populate the surname' }).toBeGreaterThan(0);
    observe(`Passport OCR completed in ${Date.now() - started} ms`);
    const snap = await form.snapshot();
    const dob = parseIsoDate(expected.dateOfBirth);
    const results = {
      surname: snap.lastName.toUpperCase() === expected.surname.toUpperCase(),
      firstName: snap.firstName.toUpperCase() === expected.givenNames.toUpperCase(),
      passportNumber: snap.passportNumber.toUpperCase() === expected.passportNumber.toUpperCase(),
      dateOfBirth: snap.dob === `${dob.getDate()} ${shortMonth(dob)} ${dob.getFullYear()}`,
      gender: snap.gender === expected.gender,
      nationality: snap.nationality.toLowerCase() === expected.nationality.toLowerCase(),
    };
    // Only field names and match results are reported; the personal values never leave this test.
    observe(`OCR field match: ${Object.entries(results).map(([k, v]) => `${k}=${v ? 'MATCH' : 'MISMATCH'}`).join(', ')}`);
    expect(Object.entries(results).filter(([, ok]) => !ok).map(([k]) => k), 'OCR fields that did not match the passport').toEqual([]);
    // The user can review and correct an extracted value.
    await form.middleName.fill('Corrected');
    await expect(form.middleName).toHaveValue('Corrected');
  });

  test('Passport upload only accepts image files', { tag: [Tag.addons, Tag.negative] }, async ({ page, requireCartCreation }) => {
    void requireCartCreation;
    const { cart } = await addonsToCart(page, 30, 1);
    await expect(cart.traveller(0).passportUpload).toHaveAttribute('accept', 'image/*');
  });

  test('Contact email and phone keep their values after moving between fields', { tag: [Tag.addons, Tag.positive] }, async ({ page, requireCartCreation }) => {
    void requireCartCreation;
    const { cart } = await addonsToCart(page, 30, 1);
    await cart.fillContact(primaryContact);
    await cart.traveller(0).surname.click();
    expect(await cart.contact.values()).toEqual(primaryContact);
  });
});

test.describe('Passenger page – completed form enables payment', { tag: [Tag.regression] }, () => {
  test.describe.configure({ timeout: timeouts.bookingFlow });

  test('Travel Add-ons: complete valid form (incl. PNR and time of travel) enables payment', { tag: [Tag.addons, Tag.positive] }, async ({ page, requireCartCreation }) => {
    void requireCartCreation;
    const { cart } = await addonsToCart(page, 30, 1);
    await completeStandardCart(cart, { addonTravel: true });
    await expect(cart.alerts).toHaveCount(0);
    await expect(cart.proceedToPay).toBeEnabled({ timeout: 30_000 });
  });
});
