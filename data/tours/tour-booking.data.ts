import { generalData } from '../common/passengers.data';

/**
 * Answers to the tour supplier's mandatory booking questions (observed keys: HOTEL, HOTEL_ADDRESS,
 * MOBILE for Cairo; EMAIL and PHONENUMBER for London, 2026-11-16; the questions are shown in Italian on DEVTEST).
 * The canonical test data has no tour pickup hotel, so the user approved clearly labelled QA values
 * on 2026-11-15. Mobile and e-mail reuse the canonical general.phone / general.email.
 */
export const tourSupplierAnswers: Record<string, string> = {
  HOTEL: 'QA Test Hotel (automation)',
  HOTEL_ADDRESS: 'QA Test Address (automation)',
  MOBILE: generalData.phone,
  EMAIL: generalData.email,
  PHONENUMBER: generalData.phone,
};
