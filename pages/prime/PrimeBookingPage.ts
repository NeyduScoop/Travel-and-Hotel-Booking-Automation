import type { Locator } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { CartPage } from '../common/CartPage';
import { PriceBreakdown, type ParsedBreakdown } from '../../components/booking/PriceBreakdown';
import type { TravellerSnapshot } from '../../components/forms/TravellerForm';
import type { PassengerCounts, Traveller } from '../../types/common.types';
import type { HotelGuests } from '../../types/hotel.types';
import type { PrimeMember } from './PrimeAccountPage';
import { ageOn, parseIsoDate } from '../../utils/date.utils';

export interface PrimeTravellerPlan {
  /** How each traveller block was filled: 'prefilled' (Main Traveller), 'dropdown' or 'account-details'. Never test data. */
  sources: string[];
  /** Fields filled because they were missing (prefilled data is never overwritten). */
  filledFields: string[][];
  /** The members entered on the cart, in block order (all members for flights; one per guest form for hotels). */
  members: PrimeMember[];
}

/** Thrown when the account's PRIME members cannot satisfy the booking; tests report it as BLOCKED (TEST DATA ISSUE). */
export class PrimeMemberDataError extends Error {}

type PaxType = 'adult' | 'child' | 'infant';

function memberAge(m: PrimeMember, travelDate: Date): number {
  if (!m.traveller.dateOfBirth) throw new PrimeMemberDataError(`TEST DATA ISSUE: PRIME member #${m.role} has no date of birth on the account.`);
  return ageOn(parseIsoDate(m.traveller.dateOfBirth), travelDate);
}

/** Airline passenger type at the travel date: adult 12+, child 2–11, infant under 2. */
export function flightPaxType(m: PrimeMember, travelDate: Date): PaxType {
  const age = memberAge(m, travelDate);
  return age >= 12 ? 'adult' : age >= 2 ? 'child' : 'infant';
}

/** Passenger counts that correlate exactly with the account's eligible PRIME members (owner rule, 2026-11-22). */
export function primeFlightPax(members: PrimeMember[], travelDate: Date): PassengerCounts {
  const types = members.map((m) => flightPaxType(m, travelDate));
  return { adults: types.filter((t) => t === 'adult').length, children: types.filter((t) => t === 'child').length, infants: types.filter((t) => t === 'infant').length };
}

/** Hotel guests for the members: adults 18+, children with their ages at check-in. */
export function primeHotelGuests(members: PrimeMember[], checkIn: Date): HotelGuests {
  const ages = members.map((m) => memberAge(m, checkIn));
  const childAges = ages.filter((a) => a < 18);
  return { adults: ages.length - childAges.length, children: childAges.length, childAges };
}

/** Order members the way the cart orders traveller blocks (adults, then children, then infants; account order within a type). */
export function orderForCart(members: PrimeMember[], travelDate: Date, typeOf: (m: PrimeMember) => PaxType = (m) => flightPaxType(m, travelDate)): PrimeMember[] {
  const rank: Record<PaxType, number> = { adult: 0, child: 1, infant: 2 };
  return members
    .map((m, i) => ({ m, i, r: m.role === 'owner' ? -1 : rank[typeOf(m)] }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.m);
}

/** True when the member has every field a traveller form may require. */
function asCompleteTraveller(m: PrimeMember, need: (keyof Traveller)[]): Traveller {
  const missing = need.filter((k) => !m.traveller[k]);
  if (missing.length) throw new PrimeMemberDataError(`TEST DATA ISSUE: PRIME member (${m.role}) is missing ${missing.join(', ')} on the account; add it under My account → Travellers.`);
  return m.traveller as Traveller;
}

/**
 * PRIME-member behaviour on top of the standard flight/hotel pages:
 *  - header link "My account" carries a "PRIME" badge;
 *  - flight cards show "Prime ₦X Member exclusive pricing" and the CTA "Book with Prime";
 *  - the cart pre-fills contact and the Main Traveller (the account holder);
 *  - the "Select traveller" dropdown of the other blocks offers only "+ Add new traveller" on DEVTEST
 *    (observed 2026-11-15 and 2026-11-22), so members missing from it are typed in from their account details;
 *  - the price panel shows a "Prime member discount -₦X" line.
 */
export class PrimeBookingPage extends BasePage {
  readonly cart = new CartPage(this.page);

  get memberBadge(): Locator {
    return this.header.getByRole('link', { name: 'My account' }).filter({ hasText: 'PRIME' });
  }

  async mainTravellerSnapshot(): Promise<TravellerSnapshot> {
    return this.cart.traveller(0).snapshot();
  }

  /**
   * Fill every traveller block with the account's eligible PRIME members (owner rule, 2026-11-22):
   *  - the number of blocks must equal the number of members;
   *  - block 1 keeps the prefilled Main Traveller (the owner); only missing fields are filled, from the owner's profile;
   *  - other blocks: pick the member from the "Select traveller" dropdown when offered, otherwise type the
   *    member's account details into the form.
   * Canonical test-data passengers are never used for PRIME bookings.
   */
  async completeWithMembers(members: PrimeMember[], travelDate: Date, product: 'flight' | 'hotel' = 'flight'): Promise<PrimeTravellerPlan> {
    const blocks = await this.cart.travellerCount();
    // One block per passenger/guest for flights and hotels alike. (An earlier reading of "1 lead-guest form" for a
    // 3-guest hotel cart was an early count: the other guest forms render a few seconds later; fixed 2026-11-22.)
    void product;
    const mismatch = blocks !== members.length;
    if (mismatch) {
      throw new PrimeMemberDataError(`TEST DATA ISSUE: the cart has ${blocks} traveller block(s) but the account has ${members.length} eligible PRIME member(s); the booking passengers must match the members.`);
    }
    const hotelType = (m: PrimeMember): PaxType => (memberAge(m, travelDate) >= 18 ? 'adult' : 'child');
    const ordered = orderForCart(members, travelDate, product === 'hotel' ? hotelType : undefined).slice(0, blocks);
    const contact = await this.cart.contact.values();
    const plan: PrimeTravellerPlan = { sources: [], filledFields: [], members: ordered };
    for (let i = 0; i < ordered.length; i += 1) {
      const member = ordered[i];
      const form = this.cart.traveller(i);
      if (i === 0) {
        // The Main Traveller is prefilled from the account; fill only gaps, never overwrite.
        plan.sources.push('prefilled');
        plan.filledFields.push(await form.fillMissing(member.traveller as Traveller, contact));
        continue;
      }
      const saved = await form.savedTravellers();
      const want = [member.traveller.lastName, member.traveller.firstName].map((s) => s.toLowerCase());
      const option = saved.options.find((o) => want.every((part) => o.toLowerCase().includes(part)));
      if (option) {
        await form.chooseSavedTraveller(option);
        plan.sources.push('dropdown');
        plan.filledFields.push(await form.fillMissing(member.traveller as Traveller, contact));
      } else {
        const need: (keyof Traveller)[] = ['title', 'firstName', 'lastName', 'dateOfBirth', 'gender', 'nationality'];
        if (await form.has('passportNumber')) need.push('passportNumber', 'passportExpiryDate', 'issuingCountry');
        await form.fill(asCompleteTraveller(member, need), contact);
        plan.sources.push('account-details');
        plan.filledFields.push(['all']);
      }
    }
    return plan;
  }

  async breakdown(): Promise<ParsedBreakdown> {
    return this.cart.priceBreakdown.readWithLines();
  }

  /** "Prime member discount" amount(s) in the price panel (0 when absent). */
  static primeDiscount(b: ParsedBreakdown): number {
    return b.sections.flatMap((s) => s.lines).filter((l) => /prime member discount/i.test(l.label)).reduce((a, l) => a + l.amount, 0);
  }

  static sectionTotal(b: ParsedBreakdown, index = 0): number {
    return b.sections[index]?.total ?? NaN;
  }

  static sectionLineSum(b: ParsedBreakdown, index = 0): number {
    return b.sections[index] ? PriceBreakdown.sectionSum(b.sections[index]) : NaN;
  }
}
