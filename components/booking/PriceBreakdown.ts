import { expect, type Locator } from '@playwright/test';
import { parseNaira } from '../../utils/assertions';

export interface BreakdownLine {
  label: string;
  amount: number;
  kind: 'charge' | 'discount' | 'subtotal';
}

export interface ParsedBreakdown {
  /** Product sections, e.g. flight and hotel blocks in a package; each ends with its own "Total". */
  sections: { lines: BreakdownLine[]; total: number }[];
  addons: { name: string; amount: number }[];
  grandTotal: number;
  text: string;
}

/**
 * Right-hand price panel of the cart / payment step (complementary region with "Total ₦X").
 * Observed formats (DEVTEST 2026-11-15):
 *   Flight:  "Flights x 2 Travellers ₦A Taxes & fees ₦B Service Charge ₦C Prime member discount -₦D Total ₦E"
 *   Hotel:   "1 Room(s) x 5 nights ₦A Service Fee ₦B Taxes and Fees ₦C Total ₦D"
 *   Add-ons: "Selected add-ons <name> ₦x …", Travel Extras: "Travel Extras ₦X Total ₦X"
 * The expected total is computed independently from the line items, not copied from a label.
 */
export class PriceBreakdown {
  constructor(readonly root: Locator) {}

  static parse(raw: string): ParsedBreakdown {
    const text = raw.replace(/\s+/g, ' ').trim();
    const [beforeAddons, afterAddons = ''] = text.split(/Selected add-ons/i);
    const sections: ParsedBreakdown['sections'] = [];
    const lineRe = /((?:Flights x \d+ Travell?ers?)|(?:\d+ Room\(s\) x \d+ nights?)|Taxes & fees|Taxes and Fees|Service Charge|Service Fee|Prime member discount|Discount|Travel Extras|Tour[^₦]*?)\s*(-?)\s*(₦[\d,]+)|Total\s*(₦[\d,]+)/gi;
    let current: BreakdownLine[] = [];
    for (const m of beforeAddons.matchAll(lineRe)) {
      if (m[4]) {
        sections.push({ lines: current, total: parseNaira(m[4]) });
        current = [];
        continue;
      }
      const label = m[1].trim();
      const discount = m[2] === '-' || /discount/i.test(label);
      current.push({ label, amount: parseNaira(m[3]), kind: discount ? 'discount' : 'charge' });
    }
    const addons: ParsedBreakdown['addons'] = [];
    let grandTotal = sections.length ? sections[sections.length - 1].total : NaN;
    if (afterAddons) {
      const promoIdx = afterAddons.search(/Promo Codes|Total ₦/i);
      const addonText = promoIdx >= 0 ? afterAddons.slice(0, promoIdx) : afterAddons;
      for (const a of addonText.matchAll(/(.+?)\s*(₦[\d,]+)/g)) addons.push({ name: a[1].trim(), amount: parseNaira(a[2]) });
      const totals = [...afterAddons.matchAll(/Total\s*(₦[\d,]+)/g)];
      if (totals.length) grandTotal = parseNaira(totals[totals.length - 1][1]);
    } else {
      const totals = [...text.matchAll(/Total\s*(₦[\d,]+)/g)];
      if (totals.length) grandTotal = parseNaira(totals[totals.length - 1][1]);
    }
    return { sections, addons, grandTotal, text };
  }

  async read(): Promise<ParsedBreakdown> {
    return PriceBreakdown.parse(await this.root.innerText());
  }

  /**
   * Flight / hotel / package panels first render only "Total ₦X"; the fare, tax, fee and discount lines
   * arrive asynchronously (trip-summary call). Wait for them before an independent price check.
   */
  async readWithLines(timeout = 60_000): Promise<ParsedBreakdown> {
    await expect(this.root).toContainText(/Taxes (?:& fees|and Fees)/i, { timeout });
    return this.read();
  }

  /** Sum of a section's charges minus its discounts. */
  static sectionSum(section: { lines: BreakdownLine[] }): number {
    return section.lines.reduce((acc, l) => acc + (l.kind === 'discount' ? -l.amount : l.amount), 0);
  }

  /** Independent expected grand total = Σ(section line items) + Σ(add-ons). */
  static expectedGrandTotal(b: ParsedBreakdown): number {
    return b.sections.reduce((acc, s) => acc + PriceBreakdown.sectionSum(s), 0) + b.addons.reduce((acc, a) => acc + a.amount, 0);
  }
}
