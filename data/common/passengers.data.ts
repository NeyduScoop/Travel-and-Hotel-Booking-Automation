import { canonicalTestData } from './test-data';
import type { ContactDetails, GeneralData, Traveller } from '../../types/common.types';

const p = canonicalTestData.passengers;

export const passengerData: { adults: Traveller[]; children: Traveller[]; infants: Traveller[] } = {
  adults: p.adults as Traveller[],
  children: p.children as Traveller[],
  infants: p.infants as Traveller[],
};

export const generalData: GeneralData = canonicalTestData.general;

export const primaryContact: ContactDetails = {
  email: generalData.email,
  phone: generalData.phone,
};

/** Contacts in the order the spec allows them to be used: primary, then fallback emails. */
export const contactsInPriority: ContactDetails[] = [
  primaryContact,
  ...generalData.fallbackEmails.map((email) => ({ email, phone: generalData.phone })),
];

export const leadAdult: Traveller = passengerData.adults[0];
