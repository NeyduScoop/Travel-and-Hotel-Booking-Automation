import { test, expect, Tag } from '../../../fixtures/test.fixture';
import { flightData } from '../../../data/flights/flight.data';
import { addDays, futureDate, today } from '../../../utils/date.utils';
import { dateOffsets } from '../../../config/test.config';

test.describe('Flights regression – search widget validation', { tag: [Tag.regression, Tag.flights] }, () => {
  test.beforeEach(async ({ flightSearch }) => {
    await flightSearch.openSearch();
  });

  test('empty search does not navigate to results', { tag: [Tag.negative] }, async ({ flightSearch, observe }) => {
    await flightSearch.submit();
    await expect(flightSearch.page).toHaveURL(/\/flights\/?$/);
    await expect(flightSearch.heading).toBeVisible();
    const alerts = await flightSearch.main.getByRole('alert').allInnerTexts();
    observe(`Validation messages shown for empty flight search: ${alerts.length ? alerts.join(' | ') : 'none'}`);
  });

  test('origin is required: destination and dates alone do not search', { tag: [Tag.negative] }, async ({ flightSearch }) => {
    await flightSearch.selectDestination(flightData.destination);
    await flightSearch.dates.selectDate('Departure', futureDate(dateOffsets.flightDepartureDays));
    await flightSearch.selectTripType('One way');
    await flightSearch.submit();
    await expect(flightSearch.page).toHaveURL(/\/flights\/?$/);
  });

  test('destination is required: origin and dates alone do not search', { tag: [Tag.negative] }, async ({ flightSearch }) => {
    await flightSearch.selectTripType('One way');
    await flightSearch.selectOrigin(flightData.departure);
    await flightSearch.dates.selectDate('Departure', futureDate(dateOffsets.flightDepartureDays));
    await flightSearch.submit();
    await expect(flightSearch.page).toHaveURL(/\/flights\/?$/);
  });

  test('same origin and destination is rejected', { tag: [Tag.negative, Tag.critical] }, async ({ flightSearch }) => {
    await flightSearch.selectTripType('One way');
    await flightSearch.selectOrigin(flightData.departure);
    await flightSearch.selectDestination(flightData.departure);
    await flightSearch.dates.selectDate('Departure', futureDate(dateOffsets.flightDepartureDays));
    await flightSearch.submit();
    await expect(flightSearch.page, 'a LOS -> LOS search must not reach results').toHaveURL(/\/flights\/?$/, { timeout: 10_000 });
  });

  test('past departure dates cannot be selected', { tag: [Tag.boundary] }, async ({ flightSearch }) => {
    await flightSearch.dates.open('Departure');
    expect(await flightSearch.dates.canGoToPreviousMonth(), 'previous-month navigation is disabled on the current month').toBe(false);
    const yesterday = addDays(today(), -1);
    if (yesterday.getMonth() === today().getMonth()) expect(await flightSearch.dates.isDayDisabled(yesterday)).toBe(true);
    expect(await flightSearch.dates.isDayDisabled(today())).toBe(false);
  });

  test('return date cannot be earlier than departure', { tag: [Tag.boundary] }, async ({ flightSearch }) => {
    const departure = futureDate(dateOffsets.flightDepartureDays);
    await flightSearch.dates.open('Departure');
    await flightSearch.dates.pick(departure);
    if (!(await flightSearch.dates.isOpen())) await flightSearch.dates.open('Return');
    expect(await flightSearch.dates.isDayDisabled(addDays(departure, -1)), 'day before departure is disabled for return').toBe(true);
    expect(await flightSearch.dates.isDayDisabled(addDays(departure, 1))).toBe(false);
  });

  test('one-way search hides the return date', { tag: [Tag.positive] }, async ({ flightSearch }) => {
    await flightSearch.selectTripType('One way');
    await expect(flightSearch.dates.field('Return')).toBeHidden();
    await expect(flightSearch.dates.field('Departure')).toBeVisible();
  });

  test('swap exchanges origin and destination', { tag: [Tag.positive] }, async ({ flightSearch }) => {
    const origin = await flightSearch.selectOrigin(flightData.departure);
    const destination = await flightSearch.selectDestination(flightData.destination);
    await flightSearch.swapButton.click();
    await expect(flightSearch.from.input).toHaveValue(destination);
    await expect(flightSearch.to.input).toHaveValue(origin);
  });

  test('REG-005: typing into a populated location field replaces its text', { tag: [Tag.positive] }, async ({ flightSearch }) => {
    await flightSearch.selectOrigin(flightData.departure);
    await flightSearch.from.input.click();
    await flightSearch.page.keyboard.type('Abuja', { delay: 50 });
    const value = await flightSearch.from.input.inputValue();
    expect(value, 'new text must replace, not append to, the existing value').not.toContain('Murtala');
    expect(value.toLowerCase()).toContain('abuja');
  });

  test('adults cannot go below one', { tag: [Tag.boundary] }, async ({ flightSearch }) => {
    await flightSearch.travellers.open();
    expect(await flightSearch.travellers.count('adult')).toBe(1);
    await expect(flightSearch.travellers.removeButton('adult')).toBeDisabled();
    await expect(flightSearch.travellers.removeButton('child')).toBeDisabled();
    await expect(flightSearch.travellers.removeButton('infant')).toBeDisabled();
  });

  test('infants cannot exceed adults', { tag: [Tag.boundary, Tag.negative] }, async ({ flightSearch }) => {
    await flightSearch.travellers.open();
    await flightSearch.travellers.setCount('infant', 1);
    await expect(flightSearch.travellers.addButton('infant'), 'a second infant requires a second adult').toBeDisabled();
    await flightSearch.travellers.setCount('adult', 2);
    await expect(flightSearch.travellers.addButton('infant')).toBeEnabled();
  });

  test('total travellers are capped', { tag: [Tag.boundary] }, async ({ flightSearch, observe }) => {
    await flightSearch.travellers.open();
    let adults = await flightSearch.travellers.count('adult');
    while (await flightSearch.travellers.addButton('adult').isEnabled()) {
      await flightSearch.travellers.addButton('adult').click();
      adults += 1;
      expect(adults, 'adult counter should stop at a maximum').toBeLessThanOrEqual(20);
    }
    observe(`Maximum adults accepted by the widget: ${adults}`);
    expect(adults).toBeLessThanOrEqual(9);
    await expect(flightSearch.travellers.addButton('child')).toBeDisabled();
  });
});
