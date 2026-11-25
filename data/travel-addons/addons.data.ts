import { canonicalTestData } from '../common/test-data';
import { readEnv } from '../../utils/environment.utils';
import type { TravelAddonTestData } from '../../types/addon.types';

/**
 * Travel Add-ons test data. "Time of travel" may be overridden per run with TIME_OF_TRAVEL (in .env locally,
 * or a GitHub Actions variable in CI), e.g. TIME_OF_TRAVEL=12:00 AM or 14:30; otherwise the canonical
 * travelAddons.timeOfTravel is used. It is not a secret.
 */
export const addonData: TravelAddonTestData = {
  ...canonicalTestData.travelAddons,
  timeOfTravel: readEnv('TIME_OF_TRAVEL') ?? canonicalTestData.travelAddons.timeOfTravel,
};

/** Airport used for Travel Add-ons search; the city is looked up via the location autocomplete. */
export const addonDeparture = {
  code: addonData.from,
  searchText: canonicalTestData.flight.departure.code === addonData.from ? canonicalTestData.flight.departure.name : addonData.from,
};
