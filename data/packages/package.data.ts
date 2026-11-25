import { canonicalTestData } from '../common/test-data';
import type { PackageDestination, PackageTestData } from '../../types/package.types';

/** Package data from the canonical test data (departure, destinations in priority order, travellers). */
export const packageData: PackageTestData = canonicalTestData.package;

/** Destinations in the exact priority order of the canonical data: primary first, then fallbacks. */
export const packageDestinationsInPriority: PackageDestination[] = [packageData.destinations.primary, ...packageData.destinations.fallback];

/** "Medina, Saudi Arabia": how a destination is named in logs and reports. */
export const packageDestinationLabel = (d: PackageDestination): string => `${d.name}, ${d.country}`;
