import { test, expect, Tag } from '../../../fixtures/test.fixture';
import { DataFactory } from '../../../utils/data.factory';
import { cabinClasses, flightData } from '../../../data/flights/flight.data';
import { elapsedMinutes, formatMinutes } from '../../../utils/duration';
import { isoDate, shortMonth } from '../../../utils/date.utils';
import { expectAllMatch } from '../../../utils/assertions';
import { timeouts } from '../../../config/test.config';
import type { FlightResultsPage } from '../../../pages/flights/FlightResultsPage';
import type { FlightSearchPage } from '../../../pages/flights/FlightSearchPage';
import type { MultiCityLegCriteria } from '../../../types/flight.types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** Results summary date format, e.g. "Mon, 14 Dec 2026". */
const summaryDate = (d: Date) => `${DAYS[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')} ${shortMonth(d)} ${d.getFullYear()}`;

/** Submit a multi-city search through the widget (the URL carries encoded leg objects, so no deep link). */
async function multiCitySearch(flightSearch: FlightSearchPage, flightResults: FlightResultsPage, legs: MultiCityLegCriteria[], blocked: (r: string) => never) {
  await flightSearch.openSearch();
  await flightSearch.fillMultiCity(legs, { adults: 1, children: 0, infants: 0 });
  await flightSearch.submit();
  await expect(flightSearch.page).toHaveURL(/tripType=multi-city/, { timeout: 30_000 });
  const outcome = await flightResults.waitForOutcome();
  if (outcome.kind === 'empty') blocked(`MISSING INVENTORY: no multi-city itineraries for ${legs.map((l) => `${l.origin.code}-${l.destination.code}`).join(', ')}.`);
}

test.describe('Flights regression – critical scenarios (TC-FLT-001…012)', { tag: [Tag.regression, Tag.flights] }, () => {
  test.describe.configure({ timeout: timeouts.bookingFlow });

  test('TC-FLT-001 round-trip search through the widget carries every criterion into results', { tag: [Tag.critical, Tag.positive] }, async ({ flightSearch, flightResults, blocked }) => {
    const c = DataFactory.flightSearch();
    await flightSearch.openSearch();
    await flightSearch.fill(c);
    await flightSearch.submit();
    const outcome = await flightResults.waitForOutcome();
    if (outcome.kind === 'empty') blocked(`MISSING INVENTORY: no round-trip ${flightData.departure.code}-${flightData.destination.code} flights.`);
    const url = new URL(flightSearch.page.url());
    expect(url.searchParams.get('origin')).toBe(c.origin.code);
    expect(url.searchParams.get('destination')).toBe(c.destination.code);
    expect(url.searchParams.get('tripType')).toBe('round-trip');
    expect(url.searchParams.get('adults')).toBe(String(c.passengers.adults));
    expect(url.searchParams.get('children')).toBe(String(c.passengers.children));
    expect(url.searchParams.get('infants')).toBe(String(c.passengers.infants));
    const summary = await flightResults.modifySearch.innerText();
    expect(summary).toContain(`${c.origin.code} → ${c.destination.code}`);
    expect(summary).toContain(summaryDate(c.departureDate));
    expect(summary).toContain(summaryDate(c.returnDate!));
    expect(summary).toContain('2 Adults, 1 Child, 1 Infant');
    expect(summary).toContain(c.cabin);
    expect(await flightResults.cards.count()).toBeGreaterThan(0);
  });

  test('TC-FLT-002 multi-city: every configured leg can be entered and searched', { tag: [Tag.critical, Tag.positive] }, async ({ flightSearch, flightResults, blocked }) => {
    const legs = DataFactory.multiCityLegs();
    await flightSearch.openSearch();
    await flightSearch.fillMultiCity(legs, { adults: 1, children: 0, infants: 0 });
    for (const [i, l] of legs.entries()) {
      const leg = flightSearch.leg(i);
      await expect(leg.from.input).toHaveValue(new RegExp(`^${l.origin.code} - `));
      await expect(leg.to.input).toHaveValue(new RegExp(`^${l.destination.code} - `));
    }
    await flightSearch.submit();
    await expect(flightSearch.page).toHaveURL(/tripType=multi-city/, { timeout: 30_000 });
    const legsParam = new URL(flightSearch.page.url()).searchParams.get('legs') ?? '';
    for (const l of legs) expect(legsParam).toContain(`${l.origin.code}|${l.destination.code}|`);
    const outcome = await flightResults.waitForOutcome();
    if (outcome.kind === 'empty') blocked('MISSING INVENTORY: no multi-city itineraries for the canonical legs.');
  });

  test('TC-FLT-003 multi-city results show every searched departure and destination', { tag: [Tag.critical, Tag.negative] }, async ({ flightSearch, flightResults, blocked }) => {
    const legs = DataFactory.multiCityLegs();
    await multiCitySearch(flightSearch, flightResults, legs, blocked);
    const header = await flightResults.modifySearch.innerText();
    const route = legs.map((l) => l.origin.code).concat(legs[legs.length - 1].destination.code);
    // Every leg endpoint must appear in the itinerary summary (none omitted or substituted).
    for (const code of new Set(route)) expect(header, `multi-city summary must mention ${code}`).toContain(code);
    expect(header, 'summary must list the intermediate destination of leg 1').toMatch(new RegExp(`${legs[0].origin.code}\\s*→\\s*${legs[0].destination.code}`));
    const card = flightResults.card(0);
    const text = (await card.innerText()).replace(/\s+/g, ' ');
    for (const l of legs) {
      expect(text, `card must show leg ${l.origin.code}→${l.destination.code}`).toMatch(new RegExp(`${l.origin.code}.*${l.destination.code}`));
    }
  });

  for (const cabin of cabinClasses) {
    test(`TC-FLT-004 cabin "${cabin}" is retained in criteria and results`, { tag: [Tag.positive] }, async ({ flightResults, blocked }) => {
      const c = DataFactory.oneWayFlight(undefined, cabin);
      await flightResults.openFor(c);
      const outcome = await flightResults.waitForOutcome();
      await expect(flightResults.modifySearch).toContainText(cabin);
      if (outcome.kind === 'empty') blocked(`MISSING INVENTORY: no ${cabin} fares for ${flightData.departure.code}-${flightData.destination.code}.`);
    });
  }

  test('TC-FLT-005 round-trip results price both directions as one itinerary', { tag: [Tag.critical, Tag.positive] }, async ({ flightResults, blocked }) => {
    const c = DataFactory.flightSearch({ passengers: { adults: 1, children: 0, infants: 0 } });
    await flightResults.openFor(c);
    if ((await flightResults.waitForOutcome()).kind === 'empty') blocked('MISSING INVENTORY: no round-trip flights.');
    for (const card of (await flightResults.cards.all()).slice(0, 3)) {
      const text = (await card.innerText()).replace(/\s+/g, ' ');
      expect(text, 'round-trip card must show a Return leg').toMatch(/Return \d{2}:\d{2}/);
      const legs = await flightResults.legTimesOf(card);
      expect(legs.length, 'outbound and return legs').toBeGreaterThanOrEqual(2);
      const s = await flightResults.summaryOf(card);
      expect(s.price).toBeGreaterThan(0);
      expect(text).toMatch(new RegExp(`${c.origin.code}.*${c.destination.code}.*${c.destination.code}.*${c.origin.code}`));
    }
  });

  test('TC-FLT-005 multi-city results price every leg as one itinerary', { tag: [Tag.positive] }, async ({ flightSearch, flightResults, blocked }) => {
    const legs = DataFactory.multiCityLegs();
    await multiCitySearch(flightSearch, flightResults, legs, blocked);
    const card = flightResults.card(0);
    expect((await flightResults.legTimesOf(card)).length, 'one time pair per leg').toBeGreaterThanOrEqual(legs.length);
    expect((await flightResults.summaryOf(card)).price).toBeGreaterThan(0);
  });

  test('TC-FLT-006 one-way card accessible name announces the searched destination', { tag: [Tag.positive] }, async ({ flightResults, blocked }) => {
    const c = DataFactory.oneWayFlight();
    await flightResults.openFor(c);
    if ((await flightResults.waitForOutcome()).kind === 'empty') blocked('MISSING INVENTORY');
    const labels = await flightResults.cards.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
    expectAllMatch(labels, new RegExp(` to ${c.destination.code}, `), 'one-way card accessible names');
  });

  test('TC-FLT-006 multi-city card accessible name announces the searched destinations', { tag: [Tag.negative] }, async ({ flightSearch, flightResults, blocked }) => {
    const legs = DataFactory.multiCityLegs();
    await multiCitySearch(flightSearch, flightResults, legs, blocked);
    const label = (await flightResults.card(0).getAttribute('aria-label')) ?? '';
    expect(label, 'multi-city card label must name the first destination').toContain(`to ${legs[0].destination.code}`);
  });

  test('TC-FLT-007 best-deals grid lists airlines and prices under the right stop category', { tag: [Tag.critical, Tag.positive] }, async ({ flightResults, blocked }) => {
    await flightResults.openFor(DataFactory.oneWayFlight());
    if ((await flightResults.waitForOutcome()).kind === 'empty') blocked('MISSING INVENTORY');
    await expect(flightResults.bestDealsGrid).toBeVisible();
    const { airlines, rows } = await flightResults.bestDeals();
    expect(airlines.length).toBeGreaterThan(0);
    expect(rows.map((r) => r.category)).toEqual(['Non stop', '1 Stop', '2+ Stops']);
    // Cross-check each priced cell against the cheapest visible card of that airline and stop category (expanding groups first).
    while ((await flightResults.groupExpanders.count()) > 0) await flightResults.groupExpanders.first().click();
    const cards = await flightResults.summaries();
    for (const row of rows) {
      for (const [airline, price] of Object.entries(row.prices)) {
        const matching = cards.filter((c) => c.airline.startsWith(airline) && (row.category === 'Non stop' ? /direct/i.test(c.stopsLabel) : row.category === '1 Stop' ? /^1 stop/i.test(c.stopsLabel) : /^[2-9] stop/i.test(c.stopsLabel)));
        if (price === null) expect(matching, `${airline} / ${row.category} shows "—" so no such card should exist`).toEqual([]);
        else expect(Math.min(...matching.map((m) => m.price)), `${airline} / ${row.category} grid price`).toBe(price);
      }
    }
  });

  test('TC-FLT-008 airline group dropdown expands to all cards and collapses again', { tag: [Tag.positive] }, async ({ flightResults, blocked }) => {
    await flightResults.openFor(DataFactory.oneWayFlight());
    if ((await flightResults.waitForOutcome()).kind === 'empty') blocked('MISSING INVENTORY');
    if (!(await flightResults.groupExpanders.count())) blocked('No grouped airline flights in this result set.');
    const expander = flightResults.groupExpanders.first();
    const label = (await expander.innerText()).trim();
    const extra = Number(/\+(\d+)/.exec(label)?.[1]);
    const before = await flightResults.cards.count();
    await expander.click();
    await expect(flightResults.cards).toHaveCount(before + extra);
    await expect(flightResults.groupCollapsers.first()).toBeVisible();
    await flightResults.groupCollapsers.first().click();
    await expect(flightResults.cards).toHaveCount(before);
  });

  for (const [box, pattern, label] of [
    [/^1 stop flights, \d+ available$/, /^1 stop$/i, '1 stop'],
    [/^2 or more stops, \d+ available$/, /^[2-9]\d* stops?$/i, '2+ stops'],
  ] as const) {
    test(`TC-FLT-009 "${label}" filter shows only matching itineraries`, { tag: [Tag.positive] }, async ({ flightResults, blocked }) => {
      await flightResults.openFor(DataFactory.oneWayFlight());
      if ((await flightResults.waitForOutcome()).kind === 'empty') blocked('MISSING INVENTORY');
      const checkbox = flightResults.filters.checkbox(box);
      const available = Number(/(\d+) available/.exec((await checkbox.getAttribute('aria-label')) ?? '')?.[1] ?? 0);
      if (!available) blocked(`No ${label} flights available on this route/date.`);
      await checkbox.check();
      await expect.poll(async () => (await flightResults.summaries()).every((s) => pattern.test(s.stopsLabel)), { timeout: 20_000 }).toBe(true);
      const stops = (await flightResults.summaries()).map((s) => s.stopsLabel);
      expect(stops.length).toBeGreaterThan(0);
      expect(stops.some((s) => /direct/i.test(s)), 'direct flights must not appear under a stops filter').toBe(false);
    });
  }

  test('TC-FLT-010 card durations equal elapsed time across time zones, midnight and layovers', { tag: [Tag.critical, Tag.positive] }, async ({ flightResults, observe, blocked }) => {
    const c = DataFactory.oneWayFlight();
    await flightResults.openFor(c);
    if ((await flightResults.waitForOutcome()).kind === 'empty') blocked('MISSING INVENTORY');
    while ((await flightResults.groupExpanders.count()) > 0) await flightResults.groupExpanders.first().click();
    const problems: string[] = [];
    for (const card of await flightResults.cards.all()) {
      const s = await flightResults.summaryOf(card);
      const [leg] = await flightResults.legTimesOf(card);
      const [shown] = await flightResults.legDurationsOf(card);
      const elapsed = elapsedMinutes(leg.depart, leg.arrive, leg.arriveDayOffset, c.origin.code, c.destination.code);
      const layoverTotal = (await flightResults.layoversOf(card)).reduce((a, l) => a + l.minutes, 0);
      if (elapsed === null) { observe(`Unknown UTC offset for ${c.origin.code}/${c.destination.code}`); continue; }
      if (s.durationMinutes !== shown) problems.push(`${s.airline}: label ${s.durationMinutes} min vs displayed ${formatMinutes(shown)}`);
      if (elapsed !== s.durationMinutes) problems.push(`${s.airline} ${leg.depart}→${leg.arrive}+${leg.arriveDayOffset}: elapsed ${formatMinutes(elapsed)} vs shown ${formatMinutes(s.durationMinutes)}`);
      if (layoverTotal >= s.durationMinutes) problems.push(`${s.airline}: layovers ${layoverTotal} min ≥ total ${s.durationMinutes} min`);
    }
    expect(problems).toEqual([]);
  });

  for (const kind of ['one-way', 'round-trip'] as const) {
    test(`TC-FLT-011 ${kind} details show flight numbers, legs, airports and baggage consistent with the card`, { tag: [Tag.positive] }, async ({ flightResults, flightDetails, blocked }) => {
      const c = kind === 'one-way' ? DataFactory.oneWayFlight() : DataFactory.flightSearch({ passengers: { adults: 1, children: 0, infants: 0 } });
      await flightResults.openFor(c);
      if ((await flightResults.waitForOutcome()).kind === 'empty') blocked('MISSING INVENTORY');
      const card = flightResults.card(0);
      const summary = await flightResults.summaryOf(card);
      await flightDetails.expand(card);
      const headings = await flightDetails.legHeadings(card);
      expect(headings.length, `${kind} leg count`).toBe(kind === 'one-way' ? 1 : 2);
      expect(headings[0]).toMatch(new RegExp(`${flightData.departure.name} to ${flightData.destination.name}`, 'i'));
      if (kind === 'round-trip') expect(headings[1]).toMatch(new RegExp(`${flightData.destination.name} to ${flightData.departure.name}`, 'i'));
      const numbers = await flightDetails.flightNumbers(card);
      expect(numbers.length).toBeGreaterThanOrEqual(headings.length);
      const legText = (await flightDetails.legs(card).allInnerTexts()).join(' ');
      expect(legText).toContain(`(${c.origin.code})`);
      expect(legText).toContain(`(${c.destination.code})`);
      const checked = summary.baggage.filter((b) => /checked/i.test(b)).map((b) => b.replace(/\s*checked/i, '').toLowerCase());
      for (const bag of await flightDetails.legBaggage(card)) expect(checked).toContain(bag.toLowerCase());
    });
  }

  test('TC-FLT-011 multi-city details show one leg per searched segment', { tag: [Tag.positive] }, async ({ flightSearch, flightResults, flightDetails, blocked }) => {
    const legs = DataFactory.multiCityLegs();
    await multiCitySearch(flightSearch, flightResults, legs, blocked);
    const card = flightResults.card(0);
    await flightDetails.expand(card);
    expect((await flightDetails.legHeadings(card)).length).toBe(legs.length);
    expect((await flightDetails.flightNumbers(card)).length).toBeGreaterThanOrEqual(legs.length);
  });

  for (const kind of ['one-way', 'round-trip'] as const) {
    test(`TC-FLT-012 ${kind}: PAX page itinerary matches the selected flight`, { tag: [Tag.critical, Tag.positive] }, async ({ flightBooking, flightDetails, flightResults, requireCartCreation, blocked }) => {
      void requireCartCreation;
      const c = kind === 'one-way' ? DataFactory.oneWayFlight() : DataFactory.flightSearch({ passengers: { adults: 1, children: 0, infants: 0 } });
      await flightResults.openFor(c);
      if ((await flightResults.waitForOutcome()).kind === 'empty') blocked('MISSING INVENTORY');
      // Read the flight numbers of the card actually booked: an unbookable first card makes the helper move to the next one.
      let numbers: string[] = [];
      const { summary } = await flightBooking.selectFirstBookable(undefined, async (card) => {
        await flightDetails.expand(card);
        numbers = await flightDetails.flightNumbers(card);
        await flightDetails.collapse(card);
      });
      const cart = flightBooking.cart;
      const text = await cart.bookingSummaryText();
      expect(text).toContain(`${c.origin.code} → ${c.destination.code}`);
      for (const n of numbers) expect(text, `flight number ${n} on PAX page`).toContain(n);
      expect(text).toContain(c.cabin);
      for (const bag of summary.baggage) expect(text.toLowerCase()).toContain(bag.toLowerCase());
      expect(text.toLowerCase()).toContain(`depart ${isoDate(c.departureDate)}`);
      if (kind === 'round-trip') expect(text.toLowerCase()).toContain(`return ${isoDate(c.returnDate!)}`);
      expect(text, 'listing price on the PAX page booking summary').toContain(`₦${summary.price.toLocaleString('en-US')}`);
    });
  }
});
