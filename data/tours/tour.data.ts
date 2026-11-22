import { canonicalTestData } from '../common/test-data';
import type { TourCategory, TourTestData } from '../../types/tour.types';

export const tourData: TourTestData = canonicalTestData.tours;

export const tourCategories: TourCategory[] = [
  'City Tours', 'Tickets & Passes', 'Day Trips', 'Food & Culture',
  'Adventure', 'Transfers', 'Nature', 'Water Sports',
];
