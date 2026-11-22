export type EnvironmentName = 'DEVTEST' | 'PREPROD' | 'PRODUCTION';

export interface EnvironmentConfig {
  name: EnvironmentName;
  baseUrl: string;
  /** Whether automation may add items to a cart (pre-payment) in this environment. */
  allowsCartCreation: boolean;
}

export enum Module {
  Flights = 'flights',
  Hotels = 'hotels',
  Tours = 'tours',
  Visa = 'visa',
  Prime = 'prime',
  TravelAddons = 'travel-addons',
}

export type Title = 'Mr' | 'Ms' | 'Mrs' | 'Miss' | 'Sir' | 'Dr' | 'HRH' | 'Hon' | 'Pst' | 'Sen';
export type Gender = 'Male' | 'Female';

export interface Traveller {
  title: Title;
  firstName: string;
  lastName: string;
  /** ISO yyyy-mm-dd */
  dateOfBirth: string;
  nationality: string;
  gender: Gender;
  passportNumber: string;
  /** ISO yyyy-mm-dd */
  passportExpiryDate: string;
  issuingCountry: string;
}

export interface ContactDetails {
  email: string;
  phone: string;
}

export interface GeneralData {
  phone: string;
  email: string;
  fallbackEmails: string[];
  pnr: string;
  timeOfTravel: string;
}

export interface PassengerCounts {
  adults: number;
  children: number;
  infants: number;
}

export interface Location {
  name: string;
  code: string;
}

/** Outcome of a search that may legitimately return no inventory. */
export type SearchOutcome = { kind: 'results'; count: number } | { kind: 'empty'; message: string };
