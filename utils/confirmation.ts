import { expect, type TestInfo } from '@playwright/test';
import { redact } from './logger';

export type CheckResult = 'MATCH' | 'MISMATCH' | 'N/A' | 'OBSERVED';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Renderings of a date seen across Wakanow pages ("Dec 18, 2026", "18 Dec 2026", "2026-12-18", "Fri, 18 Dec 2026"). */
export function dateVariants(d: Date): string[] {
  const dd = d.getDate();
  const m = MON[d.getMonth()];
  const y = d.getFullYear();
  const iso = `${y}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  return [`${m} ${dd}, ${y}`, `${dd} ${m} ${y}`, iso, `${DOW[d.getDay()]}, ${dd} ${m} ${y}`, `${String(dd).padStart(2, '0')} ${m} ${y}`];
}

export const naira = (n: number): string => `₦${n.toLocaleString('en-US')}`;

export interface IntegrityRow {
  field: string;
  expected: string;
  actual: string;
  result: CheckResult;
  note?: string;
}

/**
 * Confirmation data-integrity checker (Phase 7). Collect every comparison, attach the full
 * expected-vs-actual table to the report, then fail once with every mismatch listed — so a
 * single wrong field never hides the others, and a loaded confirmation page is never a PASS
 * on its own.
 */
export class IntegrityCheck {
  readonly rows: IntegrityRow[] = [];

  constructor(private readonly title: string) {}

  /** Exact value comparison (numbers are compared numerically, strings case-insensitively). */
  equal(field: string, expected: string | number, actual: string | number | null | undefined, note?: string): this {
    const a = actual ?? '';
    const ok = typeof expected === 'number' ? Number(a) === expected : String(a).trim().toLowerCase() === String(expected).trim().toLowerCase();
    this.rows.push({ field, expected: String(expected), actual: String(a), result: ok ? 'MATCH' : 'MISMATCH', note });
    return this;
  }

  /** The confirmation text must contain the expected value (used where layouts are free-form). */
  contains(field: string, expected: string, haystack: string, note?: string): this {
    const ok = haystack.toLowerCase().includes(expected.toLowerCase());
    this.rows.push({ field, expected, actual: ok ? expected : '(not found on confirmation)', result: ok ? 'MATCH' : 'MISMATCH', note });
    return this;
  }

  /**
   * Like contains(), for personal data that must never be reported (PRIME members' names): the real value is
   * compared, but the table and failure message show only "present" / "absent".
   */
  containsPrivate(field: string, expected: string, haystack: string, note = 'value not reported (personal data)'): this {
    const ok = expected !== '' && haystack.toLowerCase().includes(expected.toLowerCase());
    this.rows.push({ field, expected: 'present', actual: ok ? 'present' : 'absent', result: ok ? 'MATCH' : 'MISMATCH', note });
    return this;
  }

  /** The confirmation text must contain at least one accepted rendering of the value (e.g. date formats). */
  containsAny(field: string, accepted: string[], haystack: string, note?: string): this {
    const hit = accepted.find((v) => haystack.toLowerCase().includes(v.toLowerCase()));
    this.rows.push({ field, expected: accepted[0], actual: hit ?? '(not found on confirmation)', result: hit ? 'MATCH' : 'MISMATCH', note });
    return this;
  }

  /** Field that cannot be compared at this stage; recorded with a reason, never silently skipped. */
  notApplicable(field: string, reason: string): this {
    this.rows.push({ field, expected: '-', actual: '-', result: 'N/A', note: reason });
    return this;
  }

  /**
   * A comparison the owner ruled must not fail the E2E flow (owner, 2026-11-22). It is still evaluated and
   * recorded: a difference is reported as OBSERVED in the table and as an `observation` annotation. Its defect
   * stays in docs/EXECUTION-REPORT.md and is asserted by the regression test named in `coveredBy`.
   */
  observe(field: string, expected: string, haystack: string, coveredBy: string): this {
    const ok = haystack.toLowerCase().includes(expected.toLowerCase());
    this.rows.push({ field, expected, actual: ok ? expected : '(not found on confirmation)', result: ok ? 'MATCH' : 'OBSERVED', note: coveredBy });
    return this;
  }

  observations(): IntegrityRow[] {
    return this.rows.filter((r) => r.result === 'OBSERVED');
  }

  mismatches(): IntegrityRow[] {
    return this.rows.filter((r) => r.result === 'MISMATCH');
  }

  toMarkdown(): string {
    const lines = [`### ${this.title}`, '', '| Field | Expected | Actual | Result | Note |', '|---|---|---|---|---|'];
    for (const r of this.rows) lines.push(`| ${r.field} | ${r.expected} | ${r.actual} | ${r.result} | ${r.note ?? ''} |`);
    return redact(lines.join('\n'));
  }

  async attach(testInfo: TestInfo): Promise<void> {
    await testInfo.attach(`${this.title.replace(/[^\w-]+/g, '-').toLowerCase()}.md`, { body: this.toMarkdown(), contentType: 'text/markdown' });
  }

  /** Attach the table and fail with every mismatch (if any). */
  async assert(testInfo: TestInfo): Promise<void> {
    await this.attach(testInfo);
    for (const o of this.observations()) testInfo.annotations.push({ type: 'observation', description: `${this.title}: ${o.field}: expected "${o.expected}", got "${o.actual}" (${o.note})` });
    const bad = this.mismatches().map((r) => `${r.field}: expected "${r.expected}", got "${r.actual}"`);
    expect(bad, `${this.title}: confirmation data mismatches`).toEqual([]);
  }
}

/** Minimal shape of a payment outcome (utils/flows PaymentOutcome) needed for the shared payment checks. */
interface PaidOutcome {
  route: string;
  routeDetail: string;
  makePaymentAmount: number;
  confirmation?: { paymentStatus: string; amountPayable: number | null; amountPaid: number | null };
  gateway?: { amountDue?: number };
}

/**
 * Shared payment checks for every E2E confirmation (owner rule 2026-11-22: record the route actually used):
 *  - the confirmation amount (Amount Payable, or Amount Paid for paid routes) equals "Make Payment";
 *  - PAYMENT STATUS matches the route: bank routes leave the booking unpaid (PENDING PAYMENT),
 *    Kalabash and card routes must show PAYMENT SUCCESSFUL;
 *  - Kalabash: the wallet invoice amount equals "Make Payment".
 */
export function paymentChecks(check: IntegrityCheck, pay: PaidOutcome): IntegrityCheck {
  const conf = pay.confirmation;
  const paid = pay.route === 'KALABASH' || pay.route === 'CARD';
  check
    .equal('Payment route used', pay.routeDetail, pay.routeDetail, 'recorded, not compared')
    .equal('Confirmation amount = Make Payment', pay.makePaymentAmount, conf?.amountPayable ?? conf?.amountPaid ?? '')
    .equal('Payment status matches the route', paid ? 'PAYMENT SUCCESSFUL' : 'PENDING PAYMENT', conf?.paymentStatus ?? '');
  if (pay.route === 'KALABASH') check.equal('Kalabash amount due = Make Payment', pay.makePaymentAmount, pay.gateway?.amountDue ?? '');
  return check;
}

/** "KQ535" → ["KQ535", "KQ 535", "Flight no: 535"] (the summary omits the airline code, observed 2026-11-22). */
export function flightNumberVariants(flightNumber: string): string[] {
  const m = /^([A-Z0-9]{2})\s*(\d{1,4})$/.exec(flightNumber.trim());
  return m ? [flightNumber, `${m[1]} ${m[2]}`, `Flight no: ${m[2]}`] : [flightNumber];
}

/** Card baggage "1 × 7kg cabin" / "2 × 23kg checked" → the summary's "BAGGAGE 1 bag · 7kg" / "CHECK IN 2 bags · 23kg". */
export function baggageVariants(cardText: string): string[] {
  const m = /^(\d+)\s*×\s*(\d+\s*kg)\s*(cabin|checked)$/i.exec(cardText.trim());
  if (!m) return [cardText];
  const [, n, kg, kind] = m;
  const bags = `${n} bag${n === '1' ? '' : 's'} · ${kg.replace(/\s+/g, '')}`;
  return [cardText, kind.toLowerCase() === 'cabin' ? `BAGGAGE ${bags}` : `CHECK IN ${bags}`];
}

/** "₦X" amount printed after a label on the summary (e.g. "Stay Total", "Service Charge", "Addons Total"); null when absent. */
export function nairaAfter(text: string, label: string): number | null {
  // String.raw keeps the regex escapes (a plain template literal turns `\s` into `s`).
  const m = new RegExp(String.raw`${label}\s*₦\s*([\d,]+)`, 'i').exec(text);
  return m ? Number(m[1].replace(/,/g, '')) : null;
}

/** Hotel summaries split the room price into "Stay Total" + "Service Charge" (observed 2026-11-22). */
export function hotelRoomPriceOnSummary(text: string): number | null {
  const stay = nairaAfter(text, 'Stay Total');
  return stay === null ? null : stay + (nairaAfter(text, 'Service Charge') ?? 0);
}
