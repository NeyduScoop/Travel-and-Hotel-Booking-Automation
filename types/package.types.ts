import type { Location } from './common.types';

export interface PackageTestData {
  departure: Location;
  destinations: { primary: string; fallback: string[] };
  travellers: number;
}

export interface PackageSearchCriteria {
  departure: Location;
  destination: string;
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
