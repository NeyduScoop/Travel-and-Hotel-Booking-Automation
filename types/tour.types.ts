export interface TourTestData {
  country: string;
  destination: string;
  travellers: number;
}

export interface TourSearchCriteria {
  country: string;
  destination: string;
  startDate: Date;
  endDate: Date;
  adults: number;
}

export type TourCategory =
  | 'City Tours'
  | 'Tickets & Passes'
  | 'Day Trips'
  | 'Food & Culture'
  | 'Adventure'
  | 'Transfers'
  | 'Nature'
  | 'Water Sports';

export interface TourCardSummary {
  title: string;
  fromPricePerAdult: number;
}
