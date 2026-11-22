import { expect, type Locator } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { LocationAutocomplete } from '../../components/search/LocationAutocomplete';
import { DatePicker } from '../../components/date-picker/DatePicker';
import { TravellerSelector } from '../../components/passengers/TravellerSelector';
import type { HotelGuests, HotelSearchCriteria } from '../../types/hotel.types';

/** /hotels — "Find your perfect stay" search widget. */
export class HotelSearchPage extends BasePage {
  readonly destination = new LocationAutocomplete(this.page, this.main, 'Destination');
  readonly dates = new DatePicker(this.page, this.main);
  readonly guests = new TravellerSelector(this.main);

  get heading(): Locator {
    return this.main.getByRole('heading', { name: 'Find your perfect stay', level: 1 });
  }
  get searchButton(): Locator {
    return this.main.getByRole('button', { name: 'Search hotels' });
  }

  async openSearch(): Promise<void> {
    await this.open('/hotels');
    await expect(this.heading).toBeVisible();
  }

  /**
   * Pick the autocomplete option whose secondary line is e.g. "Makkah, Saudi Arabia".
   * The canonical data names the full country; DEVTEST (observed 2026-11-16) abbreviates some
   * countries ("London, UK"). The city and the country are both still required, so "London, Canada"
   * and "London, USA" never satisfy "London, United Kingdom".
   */
  async selectDestination(query: string, optionText: string): Promise<string> {
    return this.destination.select(query, destinationOptionPattern(optionText), new RegExp(query, 'i'));
  }

  async setGuests(guests: HotelGuests, rooms: number): Promise<void> {
    await this.guests.open();
    await this.guests.setCount('adult', guests.adults);
    await this.guests.setCount('child', guests.children);
    for (const [i, age] of (guests.childAges ?? []).entries()) await this.guests.setChildAge(i, age);
    await this.guests.setCount('room', rooms);
    await this.guests.done();
  }

  async fill(c: HotelSearchCriteria): Promise<void> {
    await this.selectDestination(c.destination, c.destinationOption);
    await this.dates.selectRange('Check-in', c.checkIn, 'Check-out', c.checkOut);
    await this.setGuests(c.guests, c.rooms);
  }

  async search(c: HotelSearchCriteria): Promise<void> {
    await this.fill(c);
    await this.searchButton.click();
  }
}

/** Short forms the hotel autocomplete uses for full country names. */
const COUNTRY_SHORT_FORMS: Record<string, string[]> = {
  'united kingdom': ['UK'],
  'united states': ['USA', 'US'],
  'united states of america': ['USA', 'US'],
  'united arab emirates': ['UAE'],
};

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** "City, Country" → a pattern that requires the city and the country (full name or a known short form) at the end. */
export function destinationOptionPattern(optionText: string): RegExp {
  const comma = optionText.lastIndexOf(',');
  if (comma < 0) return new RegExp(escapeRegex(optionText), 'i');
  const city = optionText.slice(0, comma).trim();
  const country = optionText.slice(comma + 1).trim();
  const names = [country, ...(COUNTRY_SHORT_FORMS[country.toLowerCase()] ?? [])].map(escapeRegex);
  return new RegExp(`${escapeRegex(city)},\\s*(?:${names.join('|')})\\s*$`, 'i');
}
