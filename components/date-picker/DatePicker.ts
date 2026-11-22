import { expect, type Locator, type Page } from '@playwright/test';
import { displayDate, monthLabel } from '../../utils/date.utils';

/**
 * Wakanow single/range date picker (`wk-datepicker`).
 *
 * The component exposes no ARIA roles on its field wrappers, so its stable component
 * class names are used for the field and grid containers; day cells and month navigation
 * are real <button>s located by accessible name ("Next month", "Previous month", "14").
 * Past days are rendered as disabled buttons.
 */
export class DatePicker {
  readonly root: Locator;
  readonly dropdown: Locator;
  readonly monthLabel: Locator;
  readonly nextMonth: Locator;
  readonly previousMonth: Locator;
  readonly grid: Locator;
  readonly fieldValues: Locator;

  constructor(private readonly page: Page, scope: Locator) {
    this.root = scope.locator('.wk-datepicker').first();
    this.dropdown = this.root.locator('.wk-datepicker__dropdown');
    this.monthLabel = this.dropdown.locator('.wk-datepicker__month-label');
    this.nextMonth = this.dropdown.getByRole('button', { name: 'Next month' });
    this.previousMonth = this.dropdown.getByRole('button', { name: 'Previous month' });
    this.grid = this.dropdown.locator('.wk-datepicker__grid');
    this.fieldValues = this.root.locator('.wk-datepicker__value');
  }

  field(label: string): Locator {
    return this.root.locator('.wk-datepicker__field').filter({ has: this.page.locator('label', { hasText: label }) });
  }

  async open(label: string): Promise<void> {
    if (await this.dropdown.isVisible()) return;
    await this.field(label).click();
    await expect(this.dropdown).toBeVisible();
  }

  async isOpen(): Promise<boolean> {
    return this.dropdown.isVisible();
  }

  async goToMonth(date: Date): Promise<void> {
    const target = monthLabel(date);
    for (let i = 0; i < 24; i += 1) {
      const current = (await this.monthLabel.innerText()).trim();
      if (current === target) return;
      const [mName, yStr] = current.split(' ');
      const currentIdx = Number(yStr) * 12 + new Date(`${mName} 1, ${yStr}`).getMonth();
      const targetIdx = date.getFullYear() * 12 + date.getMonth();
      await (targetIdx > currentIdx ? this.nextMonth : this.previousMonth).click();
      await expect(this.monthLabel).not.toHaveText(current);
    }
    throw new Error(`Could not navigate date picker to ${target}`);
  }

  day(date: Date): Locator {
    return this.grid.getByRole('button', { name: String(date.getDate()), exact: true });
  }

  /** Pick a date in the open calendar. */
  async pick(date: Date): Promise<void> {
    await this.goToMonth(date);
    await this.day(date).click();
  }

  /** Open `label` and pick `date`; verifies the field now shows the date. */
  async selectDate(label: string, date: Date): Promise<void> {
    await this.open(label);
    await this.pick(date);
    await expect(this.field(label)).toContainText(displayDate(date));
  }

  /** Select a start/end range (range pickers keep the calendar open after the first click). */
  async selectRange(startLabel: string, start: Date, endLabel: string, end: Date): Promise<void> {
    await this.open(startLabel);
    await this.pick(start);
    if (!(await this.isOpen())) await this.open(endLabel);
    await this.pick(end);
    await expect(this.field(startLabel)).toContainText(displayDate(start));
    await expect(this.field(endLabel)).toContainText(displayDate(end));
  }

  async isDayDisabled(date: Date): Promise<boolean> {
    await this.goToMonth(date);
    return this.day(date).isDisabled();
  }

  async canGoToPreviousMonth(): Promise<boolean> {
    return this.previousMonth.isEnabled();
  }

  async values(): Promise<string[]> {
    return (await this.fieldValues.allInnerTexts()).map((t) => t.trim());
  }

  async close(): Promise<void> {
    const closeBtn = this.dropdown.getByRole('button', { name: 'Close calendar' });
    if (await closeBtn.isVisible()) await closeBtn.click();
    else await this.page.keyboard.press('Escape');
  }
}
