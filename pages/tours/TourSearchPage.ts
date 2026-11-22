import { expect, type Locator } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { LocationAutocomplete } from '../../components/search/LocationAutocomplete';
import { DatePicker } from '../../components/date-picker/DatePicker';
import { TravellerSelector } from '../../components/passengers/TravellerSelector';
import type { TourSearchCriteria } from '../../types/tour.types';

/** /tours — "Explore Tours & Experiences". Destination is disabled until a country is chosen. */
export class TourSearchPage extends BasePage {
  readonly country = new LocationAutocomplete(this.page, this.main, 'Country');
  readonly destination = new LocationAutocomplete(this.page, this.main, 'Destination');
  readonly dates = new DatePicker(this.page, this.main);
  readonly travellers = new TravellerSelector(this.main);

  get heading(): Locator {
    return this.main.getByRole('heading', { name: 'Explore Tours & Experiences', level: 1 });
  }
  get searchButton(): Locator {
    return this.main.getByRole('button', { name: 'Search tours' });
  }

  async openSearch(): Promise<void> {
    await this.open('/tours');
    await expect(this.heading).toBeVisible();
  }

  async selectCountry(country: string): Promise<string> {
    return this.country.select(country, new RegExp(`^\\s*${country}\\s*$`, 'i'), new RegExp(country, 'i'));
  }

  async selectDestination(destination: string): Promise<string> {
    await expect(this.destination.input).toBeEnabled();
    return this.destination.select(destination, new RegExp(destination, 'i'), new RegExp(destination, 'i'));
  }

  async fill(c: TourSearchCriteria): Promise<void> {
    await this.selectCountry(c.country);
    await this.selectDestination(c.destination);
    await this.dates.selectRange('Start date', c.startDate, 'End date', c.endDate);
    await this.travellers.open();
    await this.travellers.setCount('adult', c.adults);
    await this.travellers.done();
  }

  async search(c: TourSearchCriteria): Promise<void> {
    await this.fill(c);
    await this.searchButton.click();
  }
}
