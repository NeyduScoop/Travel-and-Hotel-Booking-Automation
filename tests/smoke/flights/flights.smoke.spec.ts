import { test, expect, Tag } from '../../../fixtures/test.fixture';
import { DataFactory } from '../../../utils/data.factory';
import { flightData, cabinClasses } from '../../../data/flights/flight.data';
import { displayDate } from '../../../utils/date.utils';
import { timeouts } from '../../../config/test.config';

test.describe('Flights smoke', { tag: [Tag.smoke, Tag.flights] }, () => {
  test.beforeEach(async ({ flightSearch }) => {
    await flightSearch.openSearch();
  });

  test('flight module loads with the full search widget', { tag: [Tag.critical, Tag.positive] }, async ({ flightSearch }) => {
    await expect(flightSearch.tripType('Round trip')).toBeChecked();
    await expect(flightSearch.tripType('One way')).toBeVisible();
    await expect(flightSearch.tripType('Multi-city')).toBeVisible();
    await expect(flightSearch.from.input).toBeEditable();
    await expect(flightSearch.to.input).toBeEditable();
    await expect(flightSearch.dates.field('Departure')).toBeVisible();
    await expect(flightSearch.dates.field('Return')).toBeVisible();
    await expect(flightSearch.travellers.trigger).toHaveText(/1 Adult/);
    await expect(flightSearch.searchButton).toBeEnabled();
  });

  test('origin and destination autocomplete select the configured airports', { tag: [Tag.positive] }, async ({ flightSearch }) => {
    const origin = await flightSearch.selectOrigin(flightData.departure);
    const destination = await flightSearch.selectDestination(flightData.destination);
    expect(origin).toMatch(new RegExp(`^${flightData.departure.code} - `));
    expect(destination).toMatch(new RegExp(`^${flightData.destination.code} - `));
  });

  test('trip type can be switched between round trip and one way', { tag: [Tag.positive] }, async ({ flightSearch }) => {
    await flightSearch.selectTripType('One way');
    await expect(flightSearch.dates.field('Return')).toBeHidden();
    await flightSearch.selectTripType('Round trip');
    await expect(flightSearch.dates.field('Return')).toBeVisible();
  });

  test('departure and return dates can be selected', { tag: [Tag.positive] }, async ({ flightSearch }) => {
    const c = DataFactory.flightSearch();
    await flightSearch.selectDates(c);
    expect(await flightSearch.dates.values()).toEqual([displayDate(c.departureDate), displayDate(c.returnDate!)]);
  });

  test('passenger configuration applies the canonical 2 adults, 1 child, 1 infant', { tag: [Tag.positive] }, async ({ flightSearch }) => {
    await flightSearch.setPassengers(flightData.passengers);
    await expect(flightSearch.travellers.trigger).toHaveText('2 Adults, 1 Child, 1 Infant');
  });

  test('every cabin class can be selected', { tag: [Tag.positive] }, async ({ flightSearch }) => {
    for (const cabin of cabinClasses) await flightSearch.selectCabin(cabin);
  });

  test('search runs and shows results or a valid empty state', { tag: [Tag.critical, Tag.positive] }, async ({ flightSearch, flightResults, observe }) => {
    test.setTimeout(timeouts.bookingFlow);
    const c = DataFactory.flightSearch();
    await flightSearch.fill(c);
    const started = Date.now();
    await flightSearch.submit();
    await expect(flightSearch.page).toHaveURL(new RegExp(`origin=${c.origin.code}.*destination=${c.destination.code}`), { timeout: 30_000 });
    const outcome = await flightResults.waitForOutcome();
    observe(`Flight search ${c.origin.code}->${c.destination.code}: ${outcome.kind} in ${Date.now() - started} ms`);
    if (outcome.kind === 'results') {
      expect(await flightResults.foundCount()).toBeGreaterThan(0);
      const first = await flightResults.summaryOf(flightResults.card(0));
      expect(first.price).toBeGreaterThan(0);
      expect([first.origin, first.destination]).toContain('LOS');
    } else {
      expect(outcome.message, 'empty state must explain that no flights were found').toMatch(/no flights|0 flights|not find|try/i);
    }
  });
});
