import { expect, type Locator } from '@playwright/test';

export type PaxRow = 'adult' | 'child' | 'infant' | 'room';
const ROW_LABEL: Record<PaxRow, string> = { adult: 'Adults', child: 'Children', infant: 'Infants', room: 'Rooms' };

/**
 * Wakanow traveller / guest counter popover (`wk-pax`), shared by Flights, Hotels,
 * Tours, Packages and Travel Add-ons. Counter buttons have accessible names such as
 * "Add adult" / "Remove infant"; hotel child ages are selects named "Child N age".
 */
export class TravellerSelector {
  readonly root: Locator;
  readonly trigger: Locator;
  readonly display: Locator;
  readonly dropdown: Locator;
  readonly doneButton: Locator;

  constructor(scope: Locator) {
    this.root = scope.locator('.wk-pax').first();
    this.trigger = this.root.locator('.wk-pax__trigger');
    this.display = this.root.locator('.wk-pax__display');
    this.dropdown = this.root.locator('.wk-pax__dropdown');
    this.doneButton = this.dropdown.getByRole('button', { name: 'Done' });
  }

  addButton(row: PaxRow): Locator {
    return this.dropdown.getByRole('button', { name: `Add ${row}`, exact: true });
  }

  removeButton(row: PaxRow): Locator {
    return this.dropdown.getByRole('button', { name: `Remove ${row}`, exact: true });
  }

  countOf(row: PaxRow): Locator {
    return this.dropdown.locator('.wk-pax__row').filter({ hasText: ROW_LABEL[row] }).locator('.wk-pax__count');
  }

  /** Open the popover; retried because a click that lands before Angular hydration is discarded. */
  async open(): Promise<void> {
    await expect(async () => {
      if (await this.dropdown.isVisible()) return;
      await this.trigger.click();
      await expect(this.dropdown).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 20_000 });
  }

  async count(row: PaxRow): Promise<number> {
    return Number((await this.countOf(row).innerText()).trim());
  }

  /** Drive a counter to `target` using the +/- buttons, verifying each step. */
  async setCount(row: PaxRow, target: number): Promise<void> {
    await this.open();
    for (let guard = 0; guard < 20; guard += 1) {
      const current = await this.count(row);
      if (current === target) return;
      const button = current < target ? this.addButton(row) : this.removeButton(row);
      if (await button.isDisabled()) {
        throw new Error(`Cannot set ${row} to ${target}: control disabled at ${current}`);
      }
      await button.click();
      await expect(this.countOf(row)).toHaveText(String(current < target ? current + 1 : current - 1));
    }
  }

  childAgeSelect(index: number): Locator {
    return this.dropdown.getByRole('combobox', { name: `Child ${index + 1} age` });
  }

  async setChildAge(index: number, age: number): Promise<void> {
    await this.childAgeSelect(index).selectOption(String(age));
  }

  async done(): Promise<void> {
    if (await this.dropdown.isVisible()) await this.doneButton.click();
    await expect(this.dropdown).toBeHidden();
  }

  async text(): Promise<string> {
    return (await this.display.innerText()).trim();
  }
}
