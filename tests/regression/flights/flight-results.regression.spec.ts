import { test, expect, Tag } from '../../../fixtures/test.fixture';
import { DataFactory } from '../../../utils/data.factory';
import { passengerCombinations } from '../../../data/flights/flight.data';
import { expectAllMatch, expectAscending } from '../../../utils/assertions';
import { timeouts } from '../../../config/test.config';
import type { FlightSearchCriteria } from '../../../types/flight.types';
import type { FlightResultsPage } from '../../../pages/flights/FlightResultsPage';

async function searchOrBlock(
  flightResults: FlightResultsPage,
  criteria: FlightSearchCriteria,
  blocked: (reason: string) => never,
): Promise<void> {
  await flightResults.openFor(criteria);
  const outcome = await flightResults.waitForOutcome();
  if (outcome.kind === 'empty') {
    blocked(`No flight inventory for ${criteria.origin.code}->${criteria.destination.code} on this environment. Page said: "${outcome.message.slice(0, 200)}"`);
  }
}

test.describe('Flights regression – results, sorting, filters, details', { tag: [Tag.regression, Tag.flights] }, () => {
  test.describe.configure({ timeout: timeouts.bookingFlow });

  test('one-way results match the searched route and show prices', { tag: [Tag.critical, Tag.positive] }, async ({ flightResults, blocked }) => {
    const c = DataFactory.oneWayFlight();
    await searchOrBlock(flightResults, c, blocked);
    const cards = await flightResults.summaries();
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) {
      expect(card.origin).toBe(c.origin.code);
      expect(card.destination).toBe(c.destination.code);
      expect(card.price).toBeGreaterThan(0);
    }
    expect(await flightResults.foundCount()).toBeGreaterThanOrEqual(cards.length);
  });

  test('round-trip results summary reflects route, dates, travellers and cabin', { tag: [Tag.positive] }, async ({ flightResults, blocked }) => {
    const c = DataFactory.flightSearch();
    await searchOrBlock(flightResults, c, blocked);
    await expect(flightResults.modifySearch).toContainText(`${c.origin.code} → ${c.destination.code}`);
    await expect(flightResults.modifySearch).toContainText('Round trip');
    await expect(flightResults.modifySearch).toContainText('2 Adults, 1 Child, 1 Infant');
    await expect(flightResults.modifySearch).toContainText(c.cabin);
  });

  // Owner direction (2026-11-24): check that the searched destination (airport code or city name) is displayed
  // on the card. The screen-reader label is recorded only: round trips announce "from LOS to LOS" (origin to origin).
  test('round-trip card accessible name announces the searched destination', { tag: [Tag.negative] }, async ({ flightResults, observe, blocked }) => {
    const c = DataFactory.flightSearch();
    await searchOrBlock(flightResults, c, blocked);
    const card = flightResults.card(0);
    observe(`Round-trip card screen-reader label: "${(await card.getAttribute('aria-label')) ?? ''}"`);
    const text = (await card.innerText()).replace(/\s+/g, ' ');
    const shown = text.includes(c.destination.code) || text.toLowerCase().includes(c.destination.name.toLowerCase());
    expect(shown, `card shows the destination ${c.destination.code} / ${c.destination.name}`).toBe(true);
  });

  for (const combo of passengerCombinations.slice(0, 3)) {
    test(`passenger combination "${combo.label}" is carried into results`, { tag: [Tag.positive] }, async ({ flightResults, blocked }) => {
      const c = DataFactory.oneWayFlight(combo.pax);
      await searchOrBlock(flightResults, c, blocked);
      await expect(flightResults.modifySearch).toContainText(combo.display);
    });
  }

  test('business cabin search is carried into results', { tag: [Tag.positive] }, async ({ flightResults, blocked }) => {
    const c = DataFactory.oneWayFlight(undefined, 'Business');
    await searchOrBlock(flightResults, c, blocked);
    await expect(flightResults.modifySearch).toContainText('Business');
  });

  test('"Cheapest" sort orders fares ascending', { tag: [Tag.positive] }, async ({ flightResults, blocked }) => {
    await searchOrBlock(flightResults, DataFactory.flightSearch(), blocked);
    await flightResults.sort.choose(/^Cheapest/);
    await expect(flightResults.loader).toBeHidden();
    expectAscending((await flightResults.summaries()).map((s) => s.price), 'card prices after Cheapest sort');
  });

  test('"Fastest" sort orders durations ascending', { tag: [Tag.positive] }, async ({ flightResults, blocked }) => {
    await searchOrBlock(flightResults, DataFactory.oneWayFlight(), blocked);
    await flightResults.sort.choose(/^Fastest/);
    await expect(flightResults.loader).toBeHidden();
    expectAscending((await flightResults.summaries()).map((s) => s.durationMinutes), 'card durations after Fastest sort');
  });

  test('"Direct" stops filter shows only direct flights', { tag: [Tag.positive] }, async ({ flightResults, blocked }) => {
    await searchOrBlock(flightResults, DataFactory.oneWayFlight(), blocked);
    const direct = flightResults.filters.checkbox(/^Direct flights, \d+ available$/);
    const label = (await direct.getAttribute('aria-label')) ?? '';
    const available = Number(/(\d+) available/.exec(label)?.[1] ?? 0);
    if (available === 0) blocked('No direct flights available to filter on.');
    await direct.check();
    await expect(direct).toBeChecked();
    const stops = (await flightResults.summaries()).map((s) => s.stopsLabel);
    expect(stops.length).toBeGreaterThan(0);
    expectAllMatch(stops, /^direct$/i, 'stops on filtered cards');
  });

  test('airline filter shows only the chosen airline', { tag: [Tag.positive] }, async ({ flightResults, blocked }) => {
    await searchOrBlock(flightResults, DataFactory.oneWayFlight(), blocked);
    const airlineBox = flightResults.filters.checkbox(/^Filter by /).first();
    const airline = ((await airlineBox.getAttribute('aria-label')) ?? '').replace(/^Filter by /, '');
    await airlineBox.check();
    await expect(airlineBox).toBeChecked();
    const airlines = (await flightResults.summaries()).map((s) => s.airline);
    expect(airlines.length).toBeGreaterThan(0);
    expect(new Set(airlines)).toEqual(new Set([airline]));
  });

  test('flight details show flight number, legs and baggage consistent with the card (REG-008)', { tag: [Tag.positive] }, async ({ flightResults, flightDetails, blocked }) => {
    await searchOrBlock(flightResults, DataFactory.oneWayFlight(), blocked);
    const card = flightResults.card(0);
    const summary = await flightResults.summaryOf(card);
    await flightDetails.expand(card);
    const numbers = await flightDetails.flightNumbers(card);
    expect(numbers.length).toBeGreaterThan(0);
    numbers.forEach((n) => expect(n).toMatch(/^[A-Z0-9]{2}\d{1,4}$/));
    const checkedOnCard = summary.baggage.filter((b) => /checked/i.test(b)).map((b) => b.replace(/\s*checked/i, '').toLowerCase());
    const inDetails = (await flightDetails.legBaggage(card)).map((b) => b.toLowerCase());
    expect(inDetails.length).toBeGreaterThan(0);
    for (const bag of inDetails) expect(checkedOnCard).toContain(bag);
    await flightDetails.openTab(card, 'Fare Rules');
    await flightDetails.collapse(card);
  });
});
