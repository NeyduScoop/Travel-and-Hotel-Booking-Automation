export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** Midnight (local) today. */
export function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

export function futureDate(daysFromToday: number): Date {
  if (daysFromToday < 0) throw new Error('futureDate() requires a non-negative offset');
  return addDays(today(), daysFromToday);
}

/** "December 2026" — matches the date-picker month label. */
export function monthLabel(d: Date): string {
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

/** "14 Dec 2026" — matches the date-picker field display. */
export function displayDate(d: Date): string {
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "2026-12-14" — matches URL query parameters. */
export function isoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function nightsBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

/** Number of month steps from the month of `from` to the month of `to`. */
export function monthDiff(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

/** Parse "6h 45m" / "13h 30m" / "45m" into minutes. */
export function parseDurationToMinutes(text: string): number {
  const h = /(\d+)\s*h/.exec(text);
  const m = /(\d+)\s*m/.exec(text);
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
}

/** Whole years of age on `onDate` for someone born on `dob`. */
export function ageOn(dob: Date, onDate: Date): number {
  let age = onDate.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    onDate.getMonth() < dob.getMonth() || (onDate.getMonth() === dob.getMonth() && onDate.getDate() < dob.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** Convert "12:00 AM" / "1:30 PM" to the 24-hour "HH:MM" value an <input type="time"> expects. */
export function toTimeInputValue(value: string): string {
  const m = /^\s*(\d{1,2}):(\d{2})\s*([AP]M)?\s*$/i.exec(value);
  if (!m) throw new Error(`Unrecognised time "${value}"`);
  let hours = Number(m[1]);
  const meridiem = m[3]?.toUpperCase();
  if (meridiem === 'AM' && hours === 12) hours = 0;
  if (meridiem === 'PM' && hours < 12) hours += 12;
  return `${String(hours).padStart(2, '0')}:${m[2]}`;
}

export const shortMonth = (d: Date): string => SHORT_MONTHS[d.getMonth()];
