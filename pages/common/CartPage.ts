import { expect, type Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { ContactForm } from '../../components/forms/ContactForm';
import { TravellerForm } from '../../components/forms/TravellerForm';
import { CountrySelect } from '../../components/forms/CountrySelect';
import { OrderSummary } from '../../components/booking/OrderSummary';
import { PriceBreakdown } from '../../components/booking/PriceBreakdown';
import { TripAddons } from '../../components/booking/TripAddons';
import { PaymentSection } from '../../components/payment/PaymentSection';
import { timeouts } from '../../config/test.config';
import { toTimeInputValue } from '../../utils/date.utils';
import type { ContactDetails, Traveller } from '../../types/common.types';

/**
 * Shared checkout page (/cart) reached from Flights "Book Now"/"Book with Prime", hotel and package
 * "Reserve", Tours "Book now" and Travel Add-ons "Continue to cart".
 * Sections: 1 Booking Summary, 2 Traveller Details, (3 Enhance Your Trip), N Payment.
 * "Proceed to Pay ₦X" stays disabled until traveller details and Terms are valid. Pressing it
 * CREATES A BOOKING RECORD and reveals the payment step, so it is only called by tests that hold
 * the `requireBookingSubmission` fixture (ALLOW_TEST_BOOKING_SUBMISSION=true).
 */
export class CartPage extends BasePage {
  readonly contact = new ContactForm(this.main);
  readonly payment = new PaymentSection(this.page, this.main);
  readonly tripAddons = new TripAddons(this.main);

  /** Price panel (complementary region ending in "Total ₦X"); present before and during payment. */
  get priceBreakdown(): PriceBreakdown {
    return new PriceBreakdown(this.main.getByRole('complementary').filter({ hasText: /Total\s*₦/ }).last());
  }
  /** Tour supplier questions rendered as `data-error-key="extra.<KEY>"` (e.g. HOTEL, HOTEL_ADDRESS, MOBILE). */
  get supplierQuestions(): Locator {
    return this.main.locator('[data-error-key^="extra."]');
  }

  async supplierQuestionKeys(): Promise<string[]> {
    return this.supplierQuestions.evaluateAll((els) => els.map((e) => (e.getAttribute('data-error-key') ?? '').replace(/^extra\./, '')));
  }

  /** Answer every supplier question from `answers`; an unanswered key is reported, never invented. */
  async answerSupplierQuestions(answers: Record<string, string>): Promise<void> {
    for (const key of await this.supplierQuestionKeys()) {
      const value = answers[key];
      if (value === undefined) throw new Error(`No configured answer for tour supplier question "${key}".`);
      await this.main.locator(`[data-error-key="extra.${key}"]`).getByRole('textbox').fill(value);
    }
  }

  /**
   * Press "Proceed to Pay" (creates the booking) and wait for the payment step.
   * Returns the booking id taken from the `Payment/Get/<bookingId>/<product>` request.
   */
  async proceedToPayment(): Promise<string> {
    await expect(this.proceedToPay).toBeEnabled({ timeout: 30_000 });
    let bookingId = '';
    const onResponse = (r: { url(): string }) => {
      const m = /\/api\/booking\/Payment\/Get\/(\d+)\//.exec(r.url());
      if (m) bookingId = m[1];
    };
    this.page.on('response', onResponse);
    try {
      // "Something went wrong / Failed to fetch" was observed under load; the app's own "Try Again" is used.
      this.lastAppErrors = await this.withAppRetry(() => this.proceedToPay.click(), this.payment.methods);
    } finally {
      this.page.off('response', onResponse);
    }
    return bookingId;
  }

  /** Application error messages recovered from during the last proceedToPayment() call. */
  lastAppErrors: string[] = [];

  get heading(): Locator {
    return this.main.getByRole('heading', { name: 'Your Booking', level: 1 });
  }
  get bookingSummaryHeading(): Locator {
    return this.main.getByRole('heading', { name: 'Booking Summary', level: 2 });
  }
  get travellerDetailsHeading(): Locator {
    return this.main.getByRole('heading', { name: 'Traveller Details', level: 2 });
  }
  get paymentHeading(): Locator {
    return this.main.getByRole('heading', { name: 'Payment', level: 2 });
  }
  get removeItemButtons(): Locator {
    return this.main.getByRole('button', { name: 'Remove item' });
  }
  get termsCheckbox(): Locator {
    return this.main.getByRole('checkbox', { name: 'Accept Terms and Conditions' });
  }
  get createProfileCheckbox(): Locator {
    return this.main.getByRole('checkbox', { name: /^Create a profile for me/ });
  }
  get proceedToPay(): Locator {
    return this.main.getByRole('button', { name: /^Proceed to Pay/ });
  }
  get summary(): OrderSummary {
    return new OrderSummary(this.main.getByRole('complementary').filter({ has: this.page.getByRole('button', { name: /^Proceed to Pay/ }) }));
  }
  /** "Remove this item?" confirmation shown after "Remove item". */
  get removeDialog(): Locator {
    return this.page.getByRole('dialog', { name: 'Remove this item?' });
  }

  async removeItem(index = 0): Promise<void> {
    await this.removeItemButtons.nth(index).click();
    await expect(this.removeDialog).toBeVisible();
    await this.removeDialog.getByRole('button', { name: 'Yes, remove' }).click();
    await expect(this.removeDialog).toBeHidden();
  }
  get alerts(): Locator {
    return this.main.getByRole('alert');
  }
  /** Travel Add-ons specific travel details. */
  get timeOfTravel(): Locator {
    return this.main.getByRole('textbox', { name: 'Time of travel' });
  }
  get pnr(): Locator {
    return this.main.getByRole('textbox', { name: /^PNR \/ Reservation number/ });
  }
  get countryOfArrival(): CountrySelect {
    return new CountrySelect(this.page, this.main.locator('[data-error-key="travel.arrivalCountry"]'), 'Country of arrival');
  }

  traveller(index = 0): TravellerForm {
    return new TravellerForm(this.page, this.main, index);
  }

  /** Number of traveller blocks rendered (one `traveller.N.title` field per traveller). */
  /**
   * Number of traveller/guest blocks. Additional blocks render a few seconds after the cart (PRIME hotel cart:
   * 1 block at first, 3 shortly after; observed 2026-11-22), so the count must hold for 3 consecutive reads
   * (polled ~1 s apart) before it is trusted.
   */
  async travellerCount(): Promise<number> {
    const blocks = this.main.locator('[data-error-key^="traveller."][data-error-key$=".title"]');
    const reads: number[] = [];
    await expect
      .poll(async () => {
        reads.push(await blocks.count());
        const last = reads.slice(-3);
        return last.length === 3 && last[0] > 0 && last.every((n) => n === last[0]);
      }, { timeout: 30_000, intervals: [1_000] })
      .toBe(true);
    return reads[reads.length - 1];
  }

  async waitForReady(): Promise<void> {
    await expect(this.page).toHaveURL(/\/cart/, { timeout: timeouts.cart });
    await expect(this.heading).toBeVisible({ timeout: timeouts.cart });
    await expect(this.contact.email).toBeVisible({ timeout: timeouts.cart });
  }

  /** Text of the "Booking Summary" section (item line, route, flight number, baggage...). */
  async bookingSummaryText(): Promise<string> {
    const heading = this.page.getByRole('heading', { name: 'Booking Summary', level: 2 });
    const remove = this.page.getByRole('button', { name: 'Remove item' });
    const section = this.main.locator('section, div').filter({ has: heading }).filter({ has: remove }).last();
    return (await section.innerText()).replace(/\s+/g, ' ').trim();
  }

  /** Fill the <input type="time"> "Time of travel" from a configured value such as "12:00 AM". */
  async setTimeOfTravel(value: string): Promise<string> {
    const inputValue = toTimeInputValue(value);
    await this.timeOfTravel.fill(inputValue);
    return inputValue;
  }

  async fillContact(contact: ContactDetails): Promise<void> {
    await this.contact.fill(contact);
  }

  /** Fill traveller blocks in order; additional travellers' own email/phone use `contact` when shown. */
  async fillTravellers(travellers: Traveller[], contact?: ContactDetails): Promise<void> {
    for (const [i, t] of travellers.entries()) await this.traveller(i).fill(t, contact);
  }

  async acceptTerms(): Promise<void> {
    await this.termsCheckbox.check();
    await expect(this.termsCheckbox).toBeChecked();
  }

  async visibleAlerts(): Promise<string[]> {
    return (await this.alerts.allInnerTexts()).map((t) => t.trim()).filter(Boolean);
  }
}
