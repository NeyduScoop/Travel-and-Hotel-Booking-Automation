import { canonicalTestData } from '../common/test-data';
import type { PackageTestData } from '../../types/package.types';

/** Package data from the canonical test data (departure, destinations in priority order, travellers). */
export const packageData: PackageTestData = canonicalTestData.package;

/** Destinations in the exact priority order of the canonical data: primary first, then fallbacks. */
export const packageDestinationsInPriority: string[] = [packageData.destinations.primary, ...packageData.destinations.fallback];
