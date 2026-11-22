import type { Location, PassengerCounts } from './common.types';

export type TripType = 'Round trip' | 'One way' | 'Multi-city';
export type CabinClass = 'Economy' | 'Premium Economy' | 'Business' | 'First Class';

export interface FlightSearchCriteria {
  tripType: TripType;
  origin: Location;
  destination: Location;
  departureDate: Date;
  returnDate?: Date;
  passengers: PassengerCounts;
  cabin: CabinClass;
}

export interface MultiCityLegCriteria {
  origin: Location;
  destination: Location;
  date: Date;
  cabin: CabinClass;
}

export interface FlightTestData {
  departure: Location;
  destination: Location & { fallback: Location[] };
  passengers: PassengerCounts;
  cabin: CabinClass;
}

/** Values parsed from a flight result card's accessible name and content. */
export interface FlightCardSummary {
  airline: string;
  origin: string;
  destination: string;
  stopsLabel: string;
  durationMinutes: number;
  price: number;
  baggage: string[];
}
