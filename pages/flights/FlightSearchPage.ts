import { expect, type Locator } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { LocationAutocomplete } from '../../components/search/LocationAutocomplete';
import { DatePicker } from '../../components/date-picker/DatePicker';
import { TravellerSelector } from '../../components/passengers/TravellerSelector';
import { MultiCityLeg } from '../../components/search/MultiCityLeg';
import type { CabinClass, FlightSearchCriteria, MultiCityLegCriteria, TripType } from '../../types/flight.types';
import type { Location, PassengerCounts } from '../../types/common.types';

/** /flights — flight search widget. */
export class FlightSearchPage extends BasePage {
  readonly from = new LocationAutocomplete(this.page, this.main, 'From');
  readonly to = new LocationAutocomplete(this.page, this.main, 'To');
  readonly dates = new DatePicker(this.page, this.main);
  readonly travellers = new TravellerSelector(this.main);

  get heading(): Locator {
    return this.main.getByRole('heading', { name: 'Search flights', level: 1 });
  }
  get tripTypeGroup(): Locator {
    return this.main.getByRole('radiogroup', { name: 'Trip type' });
  }
  tripType(type: TripType): Locator {
    return this.tripTypeGroup.getByRole('radio', { name: type, exact: true });
  }
  /** Cabin <select> has no accessible name; it is the only combobox offering "Economy". */
  get cabinSelect(): Locator {
    return this.main.getByRole('combobox').filter({ has: this.page.getByRole('option', { name: 'Economy', exact: true }) });
  }
  get swapButton(): Locator {
    return this.main.getByRole('button', { name: 'Swap origin and destination' });
  }
  get searchButton(): Locator {
    return this.main.getByRole('button', { name: 'Search flights' });
  }

  async openSearch(): Promise<void> {
    await this.open('/flights');
    await expect(this.heading).toBeVisible();
  }

  // ---- Multi-city -------------------------------------------------------------------------
  get addLegButton(): Locator {
    return this.main.getByRole('button', { name: 'Add another flight' });
  }

  leg(index: number): MultiCityLeg {
    return new MultiCityLeg(this.page, this.main, index);
  }

  async legCount(): Promise<number> {
    return this.main.locator('.wk-search-shell__leg').count();
  }

  /** Fill every multi-city leg (adding legs as needed) and the shared traveller counter. */
  async fillMultiCity(legs: MultiCityLegCriteria[], passengers: PassengerCounts): Promise<void> {
    await this.selectTripType('Multi-city');
    for (const [i, l] of legs.entries()) {
      if (i >= (await this.legCount())) await this.addLegButton.click();
      const leg = this.leg(i);
      await leg.from.select(l.origin.name, l.origin.code, l.origin.code);
      await leg.to.select(l.destination.name, l.destination.code, l.destination.code);
      await leg.date.selectDate('Departure', l.date);
      await leg.selectCabin(l.cabin);
    }
    await this.setPassengers(passengers);
  }

  async selectTripType(type: TripType): Promise<void> {
    await this.tripType(type).check();
    await expect(this.tripType(type)).toBeChecked();
  }

  async selectCabin(cabin: CabinClass): Promise<void> {
    await this.cabinSelect.selectOption({ label: cabin });
    await expect(this.cabinSelect.locator('option:checked')).toHaveText(new RegExp(`^\\s*${cabin}\\s*$`));
  }

  async selectOrigin(location: Location): Promise<string> {
    return this.from.select(location.name, location.code, location.code);
  }

  async selectDestination(location: Location): Promise<string> {
    return this.to.select(location.name, location.code, location.code);
  }

  async setPassengers(pax: PassengerCounts): Promise<void> {
    await this.travellers.open();
    // Adults first so the infant limit (infants <= adults) is never hit while increasing.
    await this.travellers.setCount('adult', pax.adults);
    await this.travellers.setCount('child', pax.children);
    await this.travellers.setCount('infant', pax.infants);
    await this.travellers.done();
  }

  async selectDates(criteria: Pick<FlightSearchCriteria, 'tripType' | 'departureDate' | 'returnDate'>): Promise<void> {
    if (criteria.tripType === 'Round trip' && criteria.returnDate) {
      await this.dates.selectRange('Departure', criteria.departureDate, 'Return', criteria.returnDate);
    } else {
      await this.dates.selectDate('Departure', criteria.departureDate);
    }
  }

  /** Fill the whole widget without submitting. */
  async fill(criteria: FlightSearchCriteria): Promise<void> {
    await this.selectTripType(criteria.tripType);
    await this.selectCabin(criteria.cabin);
    await this.selectOrigin(criteria.origin);
    await this.selectDestination(criteria.destination);
    await this.selectDates(criteria);
    await this.setPassengers(criteria.passengers);
  }

  async submit(): Promise<void> {
    await this.searchButton.click();
  }

  async search(criteria: FlightSearchCriteria): Promise<void> {
    await this.fill(criteria);
    await this.submit();
  }
}
