import { flightData } from '../data/flights/flight.data';
import { hotelData } from '../data/hotels/hotel.data';
import { tourData } from '../data/tours/tour.data';
import { dateOffsets } from '../config/test.config';
import { passengerData } from '../data/common/passengers.data';
import { addDays, ageOn, futureDate, parseIsoDate } from './date.utils';
import { packageData } from '../data/packages/package.data';
import type { FlightSearchCriteria, CabinClass, MultiCityLegCriteria, TripType } from '../types/flight.types';
import type { PackageDestination, PackageSearchCriteria } from '../types/package.types';
import type { HotelSearchCriteria } from '../types/hotel.types';
import type { TourSearchCriteria } from '../types/tour.types';
import type { Location, PassengerCounts, Traveller } from '../types/common.types';

/**
 * Builds search criteria from the canonical test data with fresh future dates on every call,
 * so parallel tests never share mutable booking data.
 */
export const DataFactory = {
  flightSearch(overrides: Partial<FlightSearchCriteria> = {}, offsetDays: number = dateOffsets.flightDepartureDays): FlightSearchCriteria {
    const departureDate = futureDate(offsetDays);
    const tripType: TripType = overrides.tripType ?? 'Round trip';
    return {
      tripType,
      origin: flightData.departure,
      destination: { name: flightData.destination.name, code: flightData.destination.code },
      departureDate,
      returnDate:
        tripType === 'Round trip'
          ? addDays(departureDate, dateOffsets.flightReturnDays - dateOffsets.flightDepartureDays)
          : undefined,
      passengers: { ...flightData.passengers },
      cabin: flightData.cabin,
      ...overrides,
    };
  },

  oneWayFlight(passengers: PassengerCounts = { adults: 1, children: 0, infants: 0 }, cabin: CabinClass = 'Economy', offsetDays?: number):
    FlightSearchCriteria {
    return DataFactory.flightSearch({ tripType: 'One way', returnDate: undefined, passengers, cabin }, offsetDays);
  },

  /** Destination list in priority order: primary then configured fallbacks (Project.md §3). */
  flightDestinationsInPriority(): Location[] {
    return [
      { name: flightData.destination.name, code: flightData.destination.code },
      ...flightData.destination.fallback,
    ];
  },

  hotelSearch(overrides: Partial<HotelSearchCriteria> = {}): HotelSearchCriteria {
    const checkIn = futureDate(dateOffsets.hotelCheckInDays);
    const [city] = hotelData.destination.primary.split(',');
    return {
      destination: city.trim(),
      destinationOption: hotelData.destination.primary,
      checkIn,
      checkOut: addDays(checkIn, dateOffsets.hotelNights),
      guests: {
        adults: hotelData.guests.adults,
        children: hotelData.guests.children,
        // Child ages are derived from the canonical child passengers' dates of birth at check-in.
        childAges: passengerData.children
          .slice(0, hotelData.guests.children)
          .map((child) => ageOn(parseIsoDate(child.dateOfBirth), checkIn)),
      },
      rooms: hotelData.rooms,
      ...overrides,
    };
  },

  tourSearch(overrides: Partial<TourSearchCriteria> = {}): TourSearchCriteria {
    return {
      country: tourData.country,
      destination: tourData.destination,
      startDate: futureDate(dateOffsets.tourStartDays),
      endDate: futureDate(dateOffsets.tourEndDays),
      adults: tourData.travellers,
      ...overrides,
    };
  },

  /**
   * Multi-city legs built only from canonical locations: departure -> destination, then back to the
   * departure a week later (e.g. LOS -> DXB, DXB -> LOS). A LOS -> ABV -> LHR plan returned no inventory
   * on DEVTEST (2026-11-15); fallbacks are not mixed in to avoid inventing routes.
   */
  multiCityLegs(offsetDays: number = dateOffsets.flightDepartureDays, cabin: CabinClass = flightData.cabin): MultiCityLegCriteria[] {
    const first = futureDate(offsetDays);
    const origin = flightData.departure;
    const destination = { name: flightData.destination.name, code: flightData.destination.code };
    return [
      { origin, destination, date: first, cabin },
      { origin: destination, destination: origin, date: addDays(first, 7), cabin },
    ];
  },

  packageSearch(destination: PackageDestination = packageData.destinations.primary, offsetDays: number = dateOffsets.tourStartDays): PackageSearchCriteria {
    const departureDate = futureDate(offsetDays);
    return {
      departure: packageData.departure,
      destination: destination.name,
      destinationCountry: destination.country,
      departureDate,
      returnDate: addDays(departureDate, 5),
      adults: packageData.travellers,
    };
  },

  /**
   * Booking-flow date offset for E2E runs: a spread of future days so repeated runs with the same
   * canonical passengers are less likely to trip the airline/hotel duplicate-booking check.
   */
  e2eOffsetDays(min = 35, spread = 60): number {
    return min + Math.floor(Math.random() * spread);
  },

  /** Canonical travellers for a party, in cart order (adults, then children, then infants). */
  travellersFor(pax: PassengerCounts): Traveller[] {
    return [
      ...passengerData.adults.slice(0, pax.adults),
      ...passengerData.children.slice(0, pax.children),
      ...passengerData.infants.slice(0, pax.infants),
    ];
  },

  /** A syntactically valid, run-unique email on a reserved test domain (never a real inbox). */
  uniqueEmail(prefix = 'wakanow.qa'): string {
    return `${prefix}+${Date.now()}${Math.floor(Math.random() * 1000)}@example.com`;
  },
};
