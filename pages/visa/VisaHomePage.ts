import { expect, type Locator } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { LocationAutocomplete } from '../../components/search/LocationAutocomplete';
import type { VisaDestinationResolution } from '../../types/visa.types';

/** /visa — "Check visa eligibility" form (Passport country, Destination, Travellers counter). */
export class VisaHomePage extends BasePage {
  readonly passportCountry = new LocationAutocomplete(this.page, this.main, 'Passport country');
  readonly destination = new LocationAutocomplete(this.page, this.main, 'Destination');

  get heading(): Locator {
    return this.main.getByRole('heading', { name: 'Visa Services', level: 1 });
  }
  get eligibilityHeading(): Locator {
    return this.main.getByRole('heading', { name: 'Check visa eligibility', level: 2 });
  }
  get travellersGroup(): Locator {
    return this.main.getByRole('group', { name: 'Number of travellers' });
  }
  get addTraveller(): Locator {
    return this.travellersGroup.getByRole('button', { name: 'Add traveller' });
  }
  get removeTraveller(): Locator {
    return this.travellersGroup.getByRole('button', { name: 'Remove traveller' });
  }
  get checkRequirements(): Locator {
    return this.main.getByRole('button', { name: 'Check requirements' });
  }
  get howItWorksHeading(): Locator {
    return this.main.getByRole('heading', { name: 'How it works', level: 2 });
  }
  visaTypeHeading(name: 'eVisa' | 'Sticker Visa' | 'Visa Consultation'): Locator {
    return this.main.getByRole('heading', { name, level: 3 });
  }

  async openVisa(): Promise<void> {
    await this.open('/visa');
    await expect(this.eligibilityHeading).toBeVisible();
  }

  async travellerCount(): Promise<number> {
    const text = (await this.travellersGroup.innerText()).replace(/[−+]/g, '').trim();
    return Number(text);
  }

  async selectPassportCountry(country: string): Promise<string> {
    return this.passportCountry.select(country, new RegExp(`^\\s*${country}\\s*$`, 'i'), new RegExp(country, 'i'));
  }

  /** Every destination offered for the selected passport country. */
  async availableDestinations(): Promise<string[]> {
    const all = await this.destination.allOptions();
    await this.destination.close();
    return all;
  }

  /**
   * Resolve the configured destination against the live list, in priority order (Project.md §13):
   * primary first, then fallbacks. Never substitutes an unconfigured destination.
   */
  async resolveDestination(priority: string[]): Promise<VisaDestinationResolution> {
    const available = await this.availableDestinations();
    const attempted: string[] = [];
    for (const [i, candidate] of priority.entries()) {
      attempted.push(candidate);
      if (available.some((a) => a.toLowerCase() === candidate.toLowerCase())) {
        return { status: 'resolved', destination: candidate, attempted, usedFallback: i > 0 };
      }
    }
    return { status: 'unavailable', attempted, available };
  }

  async selectDestination(destination: string): Promise<string> {
    return this.destination.select(destination, new RegExp(`^\\s*${destination}\\s*$`, 'i'), new RegExp(destination, 'i'));
  }
}
