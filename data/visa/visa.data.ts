import { canonicalTestData } from '../common/test-data';
import type { VisaTestData } from '../../types/visa.types';

export const visaData: VisaTestData = canonicalTestData.visa;

/** Destinations in the exact priority order supplied by the canonical test data. */
export const visaDestinationsInPriority: string[] = [visaData.destinations.primary, ...visaData.destinations.fallback];
