export interface HotelGuests {
  adults: number;
  children: number;
  /** One age (0-17) per child. */
  childAges?: number[];
}

export interface HotelSearchCriteria {
  destination: string;
  /** Text used to pick the right autocomplete option, e.g. "Makkah, Saudi Arabia". */
  destinationOption: string;
  checkIn: Date;
  checkOut: Date;
  guests: HotelGuests;
  rooms: number;
}

export interface HotelTestData {
  destination: { primary: string; fallback: string[] };
  guests: { adults: number; children: number };
  rooms: number;
}

export interface HotelCardSummary {
  name: string;
  umrahApproved: boolean;
  nights: number;
  totalPrice: number;
  perNightPrice: number;
  /** "Prime ₦X Member exclusive pricing" shown on the card. */
  primePrice?: number;
}
