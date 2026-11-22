import { canonicalTestData } from '../common/test-data';
import type { TravelAddonTestData } from '../../types/addon.types';

export const addonData: TravelAddonTestData = canonicalTestData.travelAddons;

/** Airport used for Travel Add-ons search; the city is looked up via the location autocomplete. */
export const addonDeparture = {
  code: addonData.from,
  searchText: canonicalTestData.flight.departure.code === addonData.from ? canonicalTestData.flight.departure.name : addonData.from,
};
