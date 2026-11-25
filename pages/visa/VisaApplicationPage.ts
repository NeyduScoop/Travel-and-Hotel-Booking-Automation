import { expect, type Locator } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { PaymentSection } from '../../components/payment/PaymentSection';
import { PriceBreakdown } from '../../components/booking/PriceBreakdown';
import { parseNaira } from '../../utils/assertions';
import type { Traveller } from '../../types/common.types';

/**
 * Visa application at /visa/apply?passport=..&destination=..&plan=..&consultation=.., reached with "Get Started"
 * on the requirements page. Inspected on DEVTEST 2026-11-23 (Ghana passport → France):
 *  - progress "1 Add travellers" → "2 Review & pay";
 *  - step 1 "Who's travelling?": per traveller "First & middle name", "Last name", "Gender" (select),
 *    "Date of birth" and "Passport expiry date" (<input type=date>), "Passport number", "Nationality"
 *    (button, prefilled with the passport country), "Email address" and "Phone number" (prefilled from the
 *    contact details); "Add another traveller"; an optional passport scan; sidebar "Continue";
 *  - step 2 "Review & pay": selected plan ("Tourist Visa · Standard", "₦X per adult"), Terms checkbox,
 *    "Proceed to payment" (disabled until Terms are accepted). Pressing it CREATES THE BOOKING
 *    (`applications/Select`, `Booking/Validate`, `Payment/Get/<id>/Visa`) and reveals the shared
 *    "Payment method" step (Card Payment, Pay with Kalabash Wallet, Pay with Flutterwave,
 *    Bank Transfer (Autoticketing)) with "Make Payment — ₦X";
 *  - Make Payment → /summary/<bookingId> ("Your Visa Application").
 * Sidebar (complementary): "<flag> France Travel dates .. Travellers N Traveller <plan> ₦A Visa Consultation ₦B Total ₦C".
 */
export class VisaApplicationPage extends BasePage {
  readonly payment = new PaymentSection(this.page, this.main);

  get heading(): Locator {
    return this.main.getByRole('heading', { name: 'Visa Application', level: 1 });
  }
  get travellersHeading(): Locator {
    return this.main.getByRole('heading', { name: "Who's travelling?", level: 2 });
  }
  get reviewHeading(): Locator {
    return this.main.getByRole('heading', { name: 'Review & pay', level: 2 });
  }
  get sidebar(): Locator {
    return this.main.getByRole('complementary');
  }
  get priceBreakdown(): PriceBreakdown {
    return new PriceBreakdown(this.sidebar);
  }
  get continueButton(): Locator {
    return this.sidebar.getByRole('button', { name: 'Continue' });
  }
  get termsCheckbox(): Locator {
    return this.main.getByRole('checkbox', { name: /^I agree to the terms and conditions/ });
  }
  /** "Proceed to payment" appears in the review panel and in the sidebar; both behave the same. */
  get proceedButton(): Locator {
    return this.main.getByRole('button', { name: 'Proceed to payment' }).first();
  }
  get addAnotherTraveller(): Locator {
    return this.main.getByRole('button', { name: 'Add another traveller' });
  }

  /** Traveller field `n` (0-based): every traveller block repeats the same labels. */
  private field(role: 'textbox' | 'combobox' | 'button', name: string, n: number): Locator {
    return this.main.getByRole(role, { name, exact: true }).nth(n);
  }
  firstName(n = 0): Locator { return this.field('textbox', 'First & middle name', n); }
  lastName(n = 0): Locator { return this.field('textbox', 'Last name', n); }
  gender(n = 0): Locator { return this.field('combobox', 'Gender', n); }
  dateOfBirth(n = 0): Locator { return this.field('textbox', 'Date of birth', n); }
  passportNumber(n = 0): Locator { return this.field('textbox', 'Passport number', n); }
  passportExpiry(n = 0): Locator { return this.field('textbox', 'Passport expiry date', n); }
  nationality(n = 0): Locator { return this.field('button', 'Nationality', n); }
  email(n = 0): Locator { return this.field('textbox', 'Email address', n); }
  phone(n = 0): Locator { return this.field('textbox', 'Phone number', n); }

  async waitForTravellerStep(): Promise<void> {
    await expect(this.page).toHaveURL(/\/visa\/apply\?/, { timeout: 60_000 });
    await expect(this.travellersHeading).toBeVisible({ timeout: 60_000 });
  }

  /** Fill traveller `n` from canonical data; the prefilled nationality, email and phone are kept. Dates use ISO (type=date). */
  async fillTraveller(t: Traveller, n = 0): Promise<void> {
    // Angular hydration can drop early input: retry until the value sticks.
    await expect(async () => {
      await this.firstName(n).fill(t.firstName);
      await expect(this.firstName(n)).toHaveValue(t.firstName, { timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    await this.lastName(n).fill(t.lastName);
    await this.gender(n).selectOption(t.gender);
    await this.dateOfBirth(n).fill(t.dateOfBirth);
    await this.passportNumber(n).fill(t.passportNumber);
    await this.passportExpiry(n).fill(t.passportExpiryDate);
  }

  async continueToReview(): Promise<void> {
    await this.continueButton.click();
    await expect(this.reviewHeading).toBeVisible({ timeout: 60_000 });
  }

  /** Plan price on the review step ("₦X per adult"). */
  async planPricePerAdult(): Promise<number> {
    return parseNaira(await this.main.getByText(/₦[\d,]+ per adult/).first().innerText());
  }

  async acceptTerms(): Promise<void> {
    await this.termsCheckbox.check();
    await expect(this.termsCheckbox).toBeChecked();
  }

  /**
   * Press "Proceed to payment" (CREATES THE BOOKING) and wait for the payment step. Only for tests holding
   * `requireBookingSubmission`. Returns the booking id from `Payment/Get/<bookingId>/Visa`.
   */
  async proceedToPayment(): Promise<string> {
    await expect(this.proceedButton).toBeEnabled({ timeout: 30_000 });
    let bookingId = '';
    const onResponse = (r: { url(): string }) => {
      const m = /\/api\/booking\/Payment\/Get\/(\d+)\//.exec(r.url());
      if (m) bookingId = m[1];
    };
    this.page.on('response', onResponse);
    try {
      await this.withAppRetry(() => this.proceedButton.click(), this.payment.methods);
    } finally {
      this.page.off('response', onResponse);
    }
    return bookingId;
  }
}
