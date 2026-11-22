import { isCI, readIntEnv } from '../utils/environment.utils';

/**
 * Timing budgets derived from the Wakanow specification and observed DEVTEST behaviour.
 * - Flight results: Project.md §8 allows up to 60 s; observed 12–20 s.
 * - Hotel room details: Project.md §11 flags > 70 s as a defect.
 */
export const timeouts = {
  /** Default per-test timeout. */
  test: 180_000,
  /** Long-running booking-path tests (search -> select -> cart). */
  bookingFlow: 300_000,
  expect: 15_000,
  action: 20_000,
  navigation: 90_000,
  /** Wait for Angular hydration (network idle) after a page load. */
  hydration: 25_000,
  autocomplete: 45_000,
  flightResults: 120_000,
  hotelResults: 150_000,
  tourResults: 120_000,
  hotelDetails: 70_000,
  addonResults: 60_000,
  cart: 90_000,
} as const;

export const execution = {
  workers: readIntEnv('WORKERS', isCI ? 2 : 4),
  retries: isCI ? 1 : 0,
} as const;

/** Booking-window offsets used to build future dates (Project.md: future dates only). */
export const dateOffsets = {
  flightDepartureDays: 30,
  flightReturnDays: 37,
  hotelCheckInDays: 30,
  hotelNights: 3,
  tourStartDays: 30,
  tourEndDays: 35,
  addonDepartureDays: 30,
} as const;
