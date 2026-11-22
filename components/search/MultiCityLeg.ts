import type { Locator, Page } from '@playwright/test';
import { LocationAutocomplete } from './LocationAutocomplete';
import { DatePicker } from '../date-picker/DatePicker';
import type { CabinClass } from '../../types/flight.types';

/**
 * One multi-city leg ("Flight N") of the flight search widget. Legs have no ARIA grouping, so the
 * leg container component class (`.wk-search-shell__leg`) is used as the scope; every control
 * inside is located by role/name: From, To, Departure, "Cabin class",
 * "Swap origin and destination for this leg".
 */
export class MultiCityLeg {
  readonly root: Locator;
  readonly from: LocationAutocomplete;
  readonly to: LocationAutocomplete;
  readonly date: DatePicker;
  readonly cabin: Locator;
  readonly swap: Locator;

  constructor(page: Page, scope: Locator, readonly index: number) {
    this.root = scope.locator('.wk-search-shell__leg').nth(index);
    this.from = new LocationAutocomplete(page, this.root, 'From');
    this.to = new LocationAutocomplete(page, this.root, 'To');
    this.date = new DatePicker(page, this.root);
    this.cabin = this.root.getByRole('combobox', { name: 'Cabin class' });
    this.swap = this.root.getByRole('button', { name: 'Swap origin and destination for this leg' });
  }

  async selectCabin(cabin: CabinClass): Promise<void> {
    await this.cabin.selectOption({ label: cabin });
  }
}
