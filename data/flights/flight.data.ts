import { canonicalTestData } from '../common/test-data';
import type { CabinClass, FlightTestData } from '../../types/flight.types';
import type { PassengerCounts } from '../../types/common.types';

export const flightData: FlightTestData = {
  departure: canonicalTestData.flight.departure,
  destination: canonicalTestData.flight.destination,
  passengers: canonicalTestData.flight.passengers,
  cabin: canonicalTestData.flight.cabin as CabinClass,
};

/** Passenger combinations for data-driven search tests. The last entry is the canonical configuration. */
export const passengerCombinations: { label: string; pax: PassengerCounts; display: string }[] = [
  { label: '1 adult', pax: { adults: 1, children: 0, infants: 0 }, display: '1 Adult' },
  { label: '2 adults + 1 child', pax: { adults: 2, children: 1, infants: 0 }, display: '2 Adults, 1 Child' },
  { label: '1 adult + 1 infant', pax: { adults: 1, children: 0, infants: 1 }, display: '1 Adult, 1 Infant' },
  {
    label: 'canonical (2A/1C/1I)',
    pax: canonicalTestData.flight.passengers,
    display: '2 Adults, 1 Child, 1 Infant',
  },
];

export const cabinClasses: CabinClass[] = ['Economy', 'Premium Economy', 'Business', 'First Class'];

/**
 * UTC offsets (hours) for airports used by the canonical data and observed itineraries, valid for the
 * December–February booking window the factory produces (northern-hemisphere standard time).
 * Used to verify card durations: elapsed = local arrival − local departure + (originOffset − destOffset).
 */
export const airportUtcOffsets: Record<string, number> = {
  LOS: 1, ABV: 1, LHR: 0, CDG: 1, FRA: 1, AMS: 1, IST: 3, DXB: 4, JFK: -5, JNB: 2, CPT: 2, NBO: 3, MED: 3, CMN: 1, DOH: 3, ADD: 3,
};

/** REG-012 technical-stop scenario (Project.md §35). Dates are historical in the spec; future dates are used. */
export const technicalStopScenario = {
  origin: { name: 'Port Harcourt', code: 'PHC' },
  destination: { name: 'Edmonton', code: 'YEG' },
  airline: 'QATAR AIRWAYS',
};
