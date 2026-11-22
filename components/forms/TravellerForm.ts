import { expect, type Locator, type Page } from '@playwright/test';
import { CountrySelect } from './CountrySelect';
import { parseIsoDate, shortMonth } from '../../utils/date.utils';
import type { Traveller } from '../../types/common.types';

export type TravellerFieldKey =
  | 'title' | 'lastName' | 'firstName' | 'dob' | 'gender' | 'nationality' | 'email' | 'phone'
  | 'passportNumber' | 'passportExpiry' | 'passportIssuingCountry';

/** Values read back from a traveller block (for persistence / prefill checks). */
export interface TravellerSnapshot {
  title: string;
  lastName: string;
  firstName: string;
  dob: string;
  gender: string;
  nationality: string;
  passportNumber: string;
}

/**
 * One traveller of the shared checkout form (Flights / Hotels / Packages / Tours / Travel Add-ons cart).
 *
 * The form is flat (no per-traveller wrapper element), but every field is wrapped in an element
 * carrying `data-error-key="traveller.<index>.<field>"` (observed on DEVTEST: title, lastName,
 * firstName, dob, gender, nationality, email, phone, passportNumber, passportExpiry,
 * passportIssuingCountry). Each control is scoped by its own key; fields a product does not
 * render (e.g. passport on hotels/tours) are simply absent.
 * Controls without a key (middle name, passport upload, PRIME "Select traveller") repeat once
 * per traveller in DOM order and are addressed by index.
 * Selecting a title auto-sets and disables the gender radios (observed 2026-11-15).
 */
export class TravellerForm {
  readonly titleField: Locator;
  readonly titleTrigger: Locator;
  readonly surname: Locator;
  readonly firstName: Locator;
  readonly middleName: Locator;
  readonly passportNumber: Locator;
  readonly male: Locator;
  readonly female: Locator;
  readonly email: Locator;
  readonly phone: Locator;
  readonly nationality: CountrySelect;
  readonly issuingCountry: CountrySelect;
  /** Hidden `<input type=file accept="image/*">` of "Upload passport to auto-fill". */
  readonly passportUpload: Locator;
  /** PRIME/signed-in only: "Select traveller" dropdown of saved travellers. */
  readonly savedTravellerSelect: Locator;

  constructor(private readonly page: Page, private readonly scope: Locator, readonly index = 0) {
    this.titleField = this.field('title');
    this.titleTrigger = this.titleField.getByRole('button');
    this.surname = this.field('lastName').getByRole('textbox', { name: 'Surname', exact: true });
    this.firstName = this.field('firstName').getByRole('textbox', { name: 'First Name', exact: true });
    this.middleName = scope.getByRole('textbox', { name: 'Middle Name (optional)', exact: true }).nth(index);
    this.passportNumber = this.field('passportNumber').getByRole('textbox', { name: 'Passport Number', exact: true });
    this.male = this.field('gender').getByRole('radio', { name: 'Male', exact: true });
    this.female = this.field('gender').getByRole('radio', { name: 'Female', exact: true });
    this.email = this.field('email').getByRole('textbox');
    this.phone = this.field('phone').getByRole('textbox');
    this.nationality = new CountrySelect(page, this.field('nationality'), 'Nationality');
    this.issuingCountry = new CountrySelect(page, this.field('passportIssuingCountry'), 'Issuing Country');
    this.passportUpload = scope.locator('wk-passport-upload input[type=file]').nth(index);
    this.savedTravellerSelect = scope
      .getByRole('combobox')
      .filter({ has: page.getByRole('option', { name: 'Select traveller', exact: true }) })
      .nth(index);
  }

  field(key: TravellerFieldKey): Locator {
    return this.scope.locator(`[data-error-key="traveller.${this.index}.${key}"]`);
  }

  async has(key: TravellerFieldKey): Promise<boolean> {
    return (await this.field(key).count()) > 0;
  }

  private dateSelect(key: 'dob' | 'passportExpiry', placeholder: 'Day' | 'Month' | 'Year'): Locator {
    return this.field(key).getByRole('combobox').filter({ has: this.page.getByRole('option', { name: placeholder, exact: true }) });
  }

  get dobDay(): Locator {
    return this.dateSelect('dob', 'Day');
  }
  get dobMonth(): Locator {
    return this.dateSelect('dob', 'Month');
  }
  get dobYear(): Locator {
    return this.dateSelect('dob', 'Year');
  }
  get expiryMonth(): Locator {
    return this.dateSelect('passportExpiry', 'Month');
  }
  get expiryYear(): Locator {
    return this.dateSelect('passportExpiry', 'Year');
  }

  /** Every option currently offered by this traveller's Title dropdown (closes it again). */
  async titleOptions(): Promise<string[]> {
    await this.titleTrigger.click();
    const options = (await this.titleField.getByRole('option').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
    await this.page.keyboard.press('Escape');
    if (await this.titleField.getByRole('listbox').isVisible()) await this.titleTrigger.click();
    return options;
  }

  async selectedTitle(): Promise<string> {
    return (await this.titleTrigger.innerText()).trim();
  }

  async selectTitle(title: string): Promise<void> {
    await this.titleTrigger.click();
    const option = this.titleField.getByRole('option', { name: title, exact: true });
    if (!(await option.count())) {
      const offered = (await this.titleField.getByRole('option').allInnerTexts()).map((t) => t.trim());
      throw new Error(`Title "${title}" is not offered for traveller ${this.index + 1} (offered: ${offered.join(', ')}). Test data and application disagree.`);
    }
    await option.click();
    await expect(this.titleTrigger).toContainText(title);
  }

  /** Set gender only when the radios are editable (a title auto-selects and locks gender). */
  async setGender(gender: 'Male' | 'Female'): Promise<void> {
    const radio = gender === 'Male' ? this.male : this.female;
    if (await radio.isDisabled()) {
      await expect(radio, `gender auto-set from title should be ${gender}`).toBeChecked();
      return;
    }
    await radio.check();
  }

  async setDateOfBirth(iso: string): Promise<void> {
    const dob = parseIsoDate(iso);
    await this.dobDay.selectOption({ label: String(dob.getDate()) });
    await this.dobMonth.selectOption({ label: shortMonth(dob) });
    await this.dobYear.selectOption({ label: String(dob.getFullYear()) });
  }

  async fill(traveller: Traveller, contact?: { email: string; phone: string }): Promise<void> {
    await this.selectTitle(traveller.title);
    await this.surname.fill(traveller.lastName);
    await this.firstName.fill(traveller.firstName);
    if (await this.has('dob')) await this.setDateOfBirth(traveller.dateOfBirth);
    if (await this.has('gender')) await this.setGender(traveller.gender);
    if ((await this.has('nationality')) && (await this.nationality.value()) !== traveller.nationality) {
      await this.nationality.select(traveller.nationality);
    }
    if (contact && (await this.has('email'))) await this.email.fill(contact.email);
    if (contact && (await this.has('phone'))) await this.phone.fill(contact.phone);
    if (await this.has('passportNumber')) {
      await this.passportNumber.fill(traveller.passportNumber);
      const expiry = parseIsoDate(traveller.passportExpiryDate);
      await this.expiryMonth.selectOption({ label: shortMonth(expiry) });
      await this.expiryYear.selectOption({ label: String(expiry.getFullYear()) });
      if ((await this.issuingCountry.value()) !== traveller.issuingCountry) await this.issuingCountry.select(traveller.issuingCountry);
    }
  }

  /** Fill only empty required fields (PRIME rule: never overwrite prefilled Main Traveller data). */
  async fillMissing(traveller: Traveller, contact?: { email: string; phone: string }): Promise<string[]> {
    const filled: string[] = [];
    if (/^Select$/i.test(await this.selectedTitle())) { await this.selectTitle(traveller.title); filled.push('title'); }
    if (!(await this.surname.inputValue())) { await this.surname.fill(traveller.lastName); filled.push('lastName'); }
    if (!(await this.firstName.inputValue())) { await this.firstName.fill(traveller.firstName); filled.push('firstName'); }
    if ((await this.has('dob')) && /^Day$/.test((await this.dobDay.locator('option:checked').innerText()).trim())) {
      await this.setDateOfBirth(traveller.dateOfBirth); filled.push('dob');
    }
    if (contact && (await this.has('email')) && !(await this.email.inputValue())) { await this.email.fill(contact.email); filled.push('email'); }
    if (contact && (await this.has('phone')) && !(await this.phone.inputValue())) { await this.phone.fill(contact.phone); filled.push('phone'); }
    if ((await this.has('passportNumber')) && !(await this.passportNumber.inputValue())) {
      if (!traveller.passportNumber || !traveller.passportExpiryDate) {
        throw new Error(`TEST DATA ISSUE: traveller ${this.index + 1} needs passport details that the source (account profile) does not provide.`);
      }
      await this.passportNumber.fill(traveller.passportNumber);
      const expiry = parseIsoDate(traveller.passportExpiryDate);
      await this.expiryMonth.selectOption({ label: shortMonth(expiry) });
      await this.expiryYear.selectOption({ label: String(expiry.getFullYear()) });
      filled.push('passport');
    }
    if ((await this.has('passportIssuingCountry')) && /Select country/i.test(await this.issuingCountry.value())) {
      await this.issuingCountry.select(traveller.issuingCountry); filled.push('issuingCountry');
    }
    return filled;
  }

  async snapshot(): Promise<TravellerSnapshot> {
    const selected = async (l: Locator) => ((await l.count()) ? (await l.locator('option:checked').innerText()).trim() : '');
    const dob = (await this.has('dob')) ? `${await selected(this.dobDay)} ${await selected(this.dobMonth)} ${await selected(this.dobYear)}` : '';
    let gender = '';
    if (await this.has('gender')) gender = (await this.male.isChecked()) ? 'Male' : (await this.female.isChecked()) ? 'Female' : '';
    return {
      title: await this.selectedTitle(),
      lastName: await this.surname.inputValue(),
      firstName: await this.firstName.inputValue(),
      dob,
      gender,
      nationality: (await this.has('nationality')) ? await this.nationality.value() : '',
      passportNumber: (await this.has('passportNumber')) ? await this.passportNumber.inputValue() : '',
    };
  }

  async savedTravellers(): Promise<{ options: string[]; selected: string }> {
    if (!(await this.savedTravellerSelect.count())) return { options: [], selected: '' };
    // Saved travellers load a few seconds after the form (observed 2026-11-22); an account without
    // saved travellers keeps only "Select traveller" + "+ Add new traveller", so the wait is bounded.
    await expect
      .poll(() => this.savedTravellerSelect.locator('option').count(), { timeout: 10_000 })
      .toBeGreaterThan(2)
      .catch(() => undefined);
    const options = (await this.savedTravellerSelect.locator('option').allInnerTexts()).map((t) => t.trim());
    const selected = (await this.savedTravellerSelect.locator('option:checked').innerText()).trim();
    return { options: options.filter((o) => !/^Select traveller$|^\+ Add new traveller$/.test(o)), selected };
  }

  async chooseSavedTraveller(label: string): Promise<void> {
    await this.savedTravellerSelect.selectOption({ label });
    await expect(this.surname).not.toHaveValue('');
  }
}
