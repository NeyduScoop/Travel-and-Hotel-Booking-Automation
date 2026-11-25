import type { Location } from './common.types';

/** A package destination city and its country (owner data, 2026-11-23); the country disambiguates "London, UK" from "London, Canada". */
export interface PackageDestination {
  name: string;
  country: string;
}

export interface PackageTestData {
  departure: Location;
  destinations: { primary: PackageDestination; fallback: PackageDestination[] };
  travellers: number;
}

export interface PackageSearchCriteria {
  departure: Location;
  /** City name, as searched and as expected on the confirmation. */
  destination: string;
  /** Country of the destination; the autocomplete option must match both. */
  destinationCountry: string;
  departureDate: Date;
  returnDate: Date;
  adults: number;
}

/** One attempted package destination and why it was (not) used (Project.md §12 fallback rule). */
export interface PackageDestinationAttempt {
  destination: string;
  outcome: 'used' | 'no-suggestion' | 'no-results' | 'error';
  reason?: string;
}

export interface PackageSelection {
  hotelName: string;
  roomName: string;
  roomTotal: number;
  flightSummary: string;
}
