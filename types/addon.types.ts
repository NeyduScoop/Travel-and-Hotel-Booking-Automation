export interface TravelAddonTestData {
  from: string;
  timeOfTravel: string;
  PNR: string;
}

export interface AddonCardSummary {
  name: string;
  unitPrice: number;
}

export interface SelectedAddonLine {
  name: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}
