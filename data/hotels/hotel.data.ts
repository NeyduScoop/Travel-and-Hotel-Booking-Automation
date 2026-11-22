import { canonicalTestData } from '../common/test-data';
import type { HotelTestData } from '../../types/hotel.types';

export const hotelData: HotelTestData = canonicalTestData.hotel;

/** Destinations in priority order (primary first, then configured fallbacks). */
export const hotelDestinationsInPriority: string[] = [hotelData.destination.primary, ...hotelData.destination.fallback];

/** Badge text observed on Umrah-approved properties (REG-001 / REG-013 / REG-023). */
export const UMRAH_BADGE = 'Umrah Approved';
