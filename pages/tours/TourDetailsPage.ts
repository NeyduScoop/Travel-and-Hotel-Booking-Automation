import { expect, type Locator } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { OrderSummary } from '../../components/booking/OrderSummary';
import { timeouts } from '../../config/test.config';
import { parseNaira } from '../../utils/assertions';

/**
 * Tour details page (/tours/<supplier>--<code>--<slug>?…).
 * "Choose your tour option" radiogroup + booking sidebar ("Book this tour") with option/language
 * selects, date, travellers, total and "Book now".
 */
export class TourDetailsPage extends BasePage {
  get heading(): Locator {
    return this.main.getByRole('heading', { level: 1 });
  }
  get optionsRegion(): Locator {
    return this.main.getByRole('region', { name: 'Choose your tour option' });
  }
  get optionRadios(): Locator {
    return this.optionsRegion.getByRole('radiogroup', { name: 'Available tour options' }).getByRole('radio');
  }
  get bookingPanel(): Locator {
    return this.main.getByRole('complementary', { name: 'Book this tour' });
  }
  get optionSelect(): Locator {
    return this.bookingPanel.getByRole('combobox', { name: 'Select Tour Option' });
  }
  get languageSelect(): Locator {
    return this.bookingPanel.getByRole('combobox', { name: 'Language' });
  }
  get dateInput(): Locator {
    return this.bookingPanel.getByRole('textbox', { name: 'Select date' });
  }
  /** Sidebar CTA (lower-case "now"); the sticky header CTA is "Book Now". */
  get bookNowButton(): Locator {
    return this.bookingPanel.getByRole('button', { name: 'Book now', exact: true });
  }
  get summary(): OrderSummary {
    return new OrderSummary(this.bookingPanel);
  }
  region(name: 'About this experience' | "What's included" | 'Meeting point' | 'Things to note' | 'Cancellation policy'): Locator {
    return this.main.getByRole('region', { name });
  }

  async waitForLoaded(): Promise<void> {
    await expect(this.heading).toBeVisible({ timeout: timeouts.tourResults });
    await expect(this.bookingPanel).toBeVisible({ timeout: timeouts.tourResults });
  }

  /** "From ₦157,970 per adult" in the booking panel. */
  async fromPricePerAdult(): Promise<number> {
    const m = /From\s*(₦[\d,]+)\s*per adult/.exec(await this.summary.text());
    if (!m) throw new Error('No "From ₦X per adult" in booking panel');
    return parseNaira(m[1]);
  }

  async travellersCount(): Promise<number> {
    const label = await this.bookingPanel.getByRole('button', { name: /Adults?/ }).innerText();
    return Number(/(\d+)/.exec(label)?.[1]);
  }

  /** Project.md §15 "Tour Options": if none is selected pick the first; otherwise keep the selection. */
  async ensureOptionSelected(): Promise<string> {
    const radios = this.optionRadios;
    await expect(radios.first()).toBeVisible();
    const count = await radios.count();
    for (let i = 0; i < count; i += 1) {
      if (await radios.nth(i).isChecked()) return (await radios.nth(i).getAttribute('aria-label')) ?? `option ${i}`;
    }
    await radios.first().check();
    return (await radios.first().getAttribute('aria-label')) ?? 'option 0';
  }
}
