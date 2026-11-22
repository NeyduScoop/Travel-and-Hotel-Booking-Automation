import { expect, type Locator } from '@playwright/test';

/**
 * Results filter side panel. Flights and Hotels render it as a complementary region with a
 * "Filters" heading; Tours renders it as the complementary region "Filter tours".
 * All controls are native checkboxes/radios/buttons with accessible names.
 */
export class FilterPanel {
  constructor(readonly root: Locator) {}

  checkbox(name: string | RegExp): Locator {
    return this.root.getByRole('checkbox', { name, exact: typeof name === 'string' });
  }

  radio(name: string | RegExp): Locator {
    return this.root.getByRole('radio', { name, exact: typeof name === 'string' });
  }

  button(name: string | RegExp): Locator {
    return this.root.getByRole('button', { name });
  }

  async check(name: string | RegExp): Promise<void> {
    const box = this.checkbox(name);
    await box.check();
    await expect(box).toBeChecked();
  }

  async uncheck(name: string | RegExp): Promise<void> {
    const box = this.checkbox(name);
    await box.uncheck();
    await expect(box).not.toBeChecked();
  }

  async chooseRadio(name: string | RegExp): Promise<void> {
    const radio = this.radio(name);
    await radio.check();
    await expect(radio).toBeChecked();
  }

  async checkboxNames(): Promise<string[]> {
    const boxes = await this.root.getByRole('checkbox').all();
    return Promise.all(boxes.map(async (b) => (await b.getAttribute('aria-label')) ?? (await b.innerText())));
  }
}
