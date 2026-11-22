import { expect, type Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { parseNaira } from '../../utils/assertions';

export interface ConfirmationData {
  bookingId: string;
  bookingRef: string;
  bookingDate: string;
  paymentStatus: string;
  amountPayable: number | null;
  /** "Amount Paid" on summaries of paid bookings (Kalabash, card). */
  amountPaid: number | null;
  text: string;
  url: string;
}

/**
 * Booking confirmation page (/summary/<bookingId>), reached after "Make Payment".
 * Observed for Travel Add-ons + Pay at Bank (2026-11-15): h1 "Good job! Booking successful",
 * "Booking ID: <id>", "BOOKING REF:", "BOOKING DATE", "PAYMENT STATUS" (e.g. PENDING PAYMENT),
 * "Personal Information" article, product table, "Fare Summary" with "Amount Payable".
 * Product sections differ per module, so module checks compare against the page text.
 */
export class ConfirmationPage extends BasePage {
  get heading(): Locator {
    return this.main.getByRole('heading', { level: 1 });
  }
  get personalInformation(): Locator {
    return this.main.getByRole('heading', { name: 'Personal Information', level: 3 });
  }
  get fareSummary(): Locator {
    return this.main.getByRole('heading', { name: 'Fare Summary', level: 2 });
  }

  async waitForLoaded(timeout = 120_000): Promise<void> {
    await expect(this.page).toHaveURL(/\/summary\/\d+/, { timeout });
    await expect(this.heading).toBeVisible({ timeout });
    await expect(this.main.getByText(/Booking ID:/)).toBeVisible({ timeout });
  }

  async read(): Promise<ConfirmationData> {
    // Labels are bare text nodes followed by <strong> values, so values are parsed from the text.
    const text = (await this.main.innerText()).replace(/\s+/g, ' ').trim();
    const grab = (re: RegExp) => re.exec(text)?.[1]?.trim() ?? '';
    const amount = /Amount Payable\s*(₦[\d,]+)/i.exec(text);
    const paid = /Amount Paid\s*(₦[\d,]+)/i.exec(text);
    return {
      bookingId: grab(/Booking ID:\s*(\d+)/i),
      bookingRef: grab(/BOOKING REF:\s*([A-Z0-9-]+)/i),
      bookingDate: grab(/BOOKING DATE\s*([A-Z][a-z]{2} \d{1,2}, \d{4})/i),
      // Known values first; paid summaries continue with "TRIP SUMMARY" / "EXTRAS SUMMARY" (observed 2026-11-22).
      paymentStatus: grab(/PAYMENT STATUS\s*(PAYMENT SUCCESSFUL|PENDING PAYMENT|[A-Z][A-Z ]*?[A-Z])(?=\s+(?:[A-Z]+ SUMMARY|Payment Status|[A-Z][a-z]))/),
      amountPayable: amount ? parseNaira(amount[1]) : null,
      amountPaid: paid ? parseNaira(paid[1]) : null,
      text,
      url: this.page.url(),
    };
  }

  /** Rows of every data table on the page (e.g. Travel extras: name / destination / date). */
  async tableRows(): Promise<string[][]> {
    const rows = await this.main.getByRole('table').locator('tbody tr, [role=row]').all();
    const out: string[][] = [];
    for (const r of rows) {
      const cells = (await r.getByRole('cell').allInnerTexts()).map((c) => c.trim());
      if (cells.length) out.push(cells);
    }
    return out;
  }
}
