import { expect, type Locator } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { OrderSummary } from '../../components/booking/OrderSummary';
import { parseNaira } from '../../utils/assertions';

/**
 * Visa requirements / plan panel shown on /visa after "Check requirements":
 * contact details, destination requirement card (visa type, validity, processing time),
 * required documents, optional consultation and the "Order Summary" with "Get Started ₦X".
 *
 * The downstream applicant / document-upload / review / declaration pages (Project.md §13
 * steps 3-7) could not be reached with the configured destinations on DEVTEST, so they are
 * intentionally NOT modelled here; see docs/TEST-COVERAGE.md.
 */
export class VisaPackagePage extends BasePage {
  get resultMain(): Locator {
    return this.main.getByRole('main');
  }
  get contactHeading(): Locator {
    return this.main.getByRole('heading', { name: 'Your contact details', level: 2 });
  }
  /** The email textbox's accessible name is its placeholder (its visible label is not associated). */
  get contactEmail(): Locator {
    return this.main.getByRole('textbox', { name: 'you@example.com' });
  }
  get contactPhone(): Locator {
    return this.main.getByRole('textbox', { name: 'Phone number' });
  }
  get modifySearch(): Locator {
    return this.main.getByRole('button', { name: 'Modify search' });
  }
  destinationHeading(destination: string): Locator {
    return this.resultMain.getByRole('heading', { name: destination, level: 2 });
  }
  get requiredDocumentsHeading(): Locator {
    return this.resultMain.getByRole('heading', { name: 'Required Documents', level: 2 });
  }
  get consultationHeading(): Locator {
    return this.resultMain.getByRole('heading', { name: 'Visa Consultation', level: 3 });
  }
  get removeConsultation(): Locator {
    return this.resultMain.getByRole('button', { name: 'Remove consultation' });
  }
  get orderSummary(): OrderSummary {
    return new OrderSummary(this.main.getByRole('complementary').filter({ has: this.page.getByRole('heading', { name: 'Order Summary' }) }));
  }
  get getStarted(): Locator {
    return this.orderSummary.cta(/^Get Started/);
  }

  async waitForRequirements(destination: string): Promise<void> {
    await expect(this.destinationHeading(destination)).toBeVisible({ timeout: 60_000 });
    await expect(this.getStarted).toBeVisible();
  }

  async lineAmounts(): Promise<{ total: number; cta: number; text: string }> {
    const text = await this.orderSummary.text();
    return { total: await this.orderSummary.total(), cta: parseNaira(await this.getStarted.innerText()), text };
  }
}
