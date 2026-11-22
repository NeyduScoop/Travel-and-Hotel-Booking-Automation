import { expect, type Locator } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import type { Gender, Title, Traveller } from '../../types/common.types';

/** A PRIME-eligible person on the signed-in account. Personal data: never log or attach it. */
export interface PrimeMember {
  role: 'owner' | 'traveller';
  traveller: Partial<Traveller> & Pick<Traveller, 'firstName' | 'lastName'>;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "12 Oct 1977" → "1977-10-12"; ISO input is returned unchanged; anything else → undefined. */
export function toIsoDate(text: string | undefined): string | undefined {
  const t = (text ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = /^(\d{1,2}) ([A-Z][a-z]{2}) (\d{4})$/.exec(t);
  if (!m || !MONTHS.includes(m[2])) return undefined;
  return `${m[3]}-${String(MONTHS.indexOf(m[2]) + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/**
 * Account profile (/account/profile, opened from the header "My account" link — a direct URL
 * redirects to /auth). Observed 2026-11-22:
 *  - the owner's plan line reads "★ Prime <plan> member";
 *  - "Travellers" lists one article per saved traveller; PRIME-covered travellers carry "★ Prime",
 *    others offer a (disabled) "Add to Prime";
 *  - "Edit" opens dialog "Edit traveller" with First/Last name, Title, Gender, DOB, passport number,
 *    expiry and issuing country. It is closed with "Cancel" — this page object never saves.
 *
 * Rule (owner instruction, 2026-11-22): PRIME bookings use exactly the account's eligible PRIME
 * members (owner + ★ Prime travellers) and never the canonical test-data passengers.
 */
export class PrimeAccountPage extends BasePage {
  get myAccountLink(): Locator {
    return this.header.getByRole('link', { name: /My account/ }).first();
  }
  get travellerCards(): Locator {
    return this.main.getByRole('article');
  }
  get primeTravellerCards(): Locator {
    return this.travellerCards.filter({ hasText: '★ Prime' });
  }
  get editDialog(): Locator {
    return this.page.getByRole('dialog', { name: 'Edit traveller' });
  }

  async openProfile(): Promise<void> {
    await expect(async () => {
      await this.goto('/');
      await this.myAccountLink.click();
      await this.page.waitForURL(/\/account\/profile/, { timeout: 30_000 });
      await expect(this.main.getByRole('heading', { name: 'Travellers', level: 2 })).toBeVisible({ timeout: 30_000 });
      await expect(this.travellerCards.first()).toBeVisible({ timeout: 30_000 });
    }).toPass({ timeout: 120_000 });
    // The profile first renders a placeholder ("0 Travellers", owner card only, no plan line) and
    // fills in a few seconds later. Read only when the plan line is present, the card count equals
    // the declared traveller count + the owner card, and that state holds for three reads.
    await this.settle();
    let stableReads = 0;
    let last = '';
    await expect
      .poll(async () => {
        const text = (await this.main.innerText()).replace(/\s+/g, ' ');
        const declared = /(\d+)\s*Travellers?\b/.exec(text);
        const cards = await this.travellerCards.count();
        const ready = /★\s*Prime\b.*?\bmember\b/.test(text) && !!declared && cards === Number(declared[1]) + 1;
        const state = `${declared?.[1]}/${cards}`;
        stableReads = ready && state === last ? stableReads + 1 : ready ? 1 : 0;
        last = state;
        return stableReads >= 3;
      }, { timeout: 60_000, intervals: [1_500] })
      .toBe(true);
  }

  async ownerIsPrimeMember(): Promise<boolean> {
    return /★\s*Prime\b.*?\bmember\b/.test((await this.main.innerText()).replace(/\s+/g, ' '));
  }

  /** Value under a label in "Primary customer details" (label text followed by a <strong>). */
  private async ownerField(label: string): Promise<string> {
    const value = this.main.getByText(label, { exact: true }).first().locator('xpath=following-sibling::strong[1]');
    return (await value.count()) ? (await value.innerText()).trim() : '';
  }

  private async readOwner(): Promise<PrimeMember> {
    const full = await this.ownerField('Full name');
    const parts = full.split(/\s+/);
    const title = /^(Mr|Ms|Mrs|Miss|Sir|Dr|HRH|Hon|Pst|Sen)$/.test(parts[0]) ? (parts.shift() as Title) : undefined;
    const gender = (await this.ownerField('Gender')) as Gender;
    return {
      role: 'owner',
      traveller: {
        title,
        firstName: parts.slice(0, -1).join(' '),
        lastName: parts[parts.length - 1] ?? '',
        dateOfBirth: toIsoDate(await this.ownerField('Date of birth')),
        gender: gender || undefined,
        nationality: (await this.ownerField('Nationality')) || undefined,
        passportNumber: (await this.ownerField('Passport')) || undefined,
        issuingCountry: (await this.ownerField('Passport issuing country')) || undefined,
      },
    };
  }

  private async readTraveller(card: Locator): Promise<PrimeMember> {
    const summary = (await card.innerText()).replace(/\s+/g, ' ');
    const nationality = /· (?:Adult|Child|Infant) · ([A-Za-z ]+?)(?: ★| Add to Prime|$)/.exec(summary)?.[1]?.trim();
    await card.getByRole('button', { name: 'Edit' }).click();
    const d = this.editDialog;
    await expect(d).toBeVisible();
    const selected = async (name: string) => (await d.getByRole('combobox', { name }).locator('option:checked').innerText()).trim();
    const button = async (name: string) => (await d.getByRole('button', { name }).innerText()).trim();
    const title = await selected('Title');
    const gender = await selected('Gender');
    const member: PrimeMember = {
      role: 'traveller',
      traveller: {
        title: title === 'Select' ? undefined : (title as Title),
        firstName: await d.getByRole('textbox', { name: 'First name' }).inputValue(),
        lastName: await d.getByRole('textbox', { name: 'Last name' }).inputValue(),
        gender: gender === 'Select' ? undefined : (gender as Gender),
        dateOfBirth: toIsoDate(await button('Date of birth')),
        nationality,
        passportNumber: (await d.getByRole('textbox', { name: 'Passport number' }).inputValue()) || undefined,
        passportExpiryDate: toIsoDate(await button('Expiry date')),
        issuingCountry: (await button('Issuing country')) || undefined,
      },
    };
    await d.getByRole('button', { name: 'Cancel' }).click();
    await expect(d).toBeHidden();
    return member;
  }

  /** Owner (when a PRIME member) followed by every "★ Prime" traveller, in list order. */
  async eligibleMembers(): Promise<PrimeMember[]> {
    await this.openProfile();
    const members: PrimeMember[] = [];
    if (await this.ownerIsPrimeMember()) members.push(await this.readOwner());
    for (const card of await this.primeTravellerCards.all()) members.push(await this.readTraveller(card));
    return members;
  }
}
