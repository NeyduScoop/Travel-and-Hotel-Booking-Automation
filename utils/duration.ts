import { airportUtcOffsets } from '../data/flights/flight.data';

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Elapsed journey minutes from local departure/arrival times, the arrival day offset ("+1") and both
 * airports' UTC offsets. Handles midnight crossings and journeys longer than 24 h.
 * Returns null when either airport's offset is unknown (the check is then reported, not guessed).
 */
export function elapsedMinutes(depart: string, arrive: string, dayOffset: number, origin: string, destination: string): number | null {
  const o = airportUtcOffsets[origin];
  const d = airportUtcOffsets[destination];
  if (o === undefined || d === undefined) return null;
  const localDiff = toMinutes(arrive) + dayOffset * 1440 - toMinutes(depart);
  return localDiff + (o - d) * 60;
}

export function formatMinutes(min: number): string {
  const sign = min < 0 ? '-' : '';
  const abs = Math.abs(min);
  return `${sign}${Math.floor(abs / 60)}h ${abs % 60}m`;
}
