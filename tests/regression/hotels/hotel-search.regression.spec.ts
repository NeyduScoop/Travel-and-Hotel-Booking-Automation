import { test, expect, Tag } from '../../../fixtures/test.fixture';
import { DataFactory } from '../../../utils/data.factory';
import { addDays, futureDate, today } from '../../../utils/date.utils';
import { dateOffsets } from '../../../config/test.config';

test.describe('Hotels regression – search widget validation', { tag: [Tag.regression, Tag.hotels] }, () => {
  test.beforeEach(async ({ hotelSearch }) => {
    await hotelSearch.openSearch();
  });

  test('empty search does not navigate to results', { tag: [Tag.negative] }, async ({ hotelSearch, observe }) => {
    await hotelSearch.searchButton.click();
    await expect(hotelSearch.page).toHaveURL(/\/hotels\/?$/);
    const alerts = await hotelSearch.main.getByRole('alert').allInnerTexts();
    observe(`Validation messages for empty hotel search: ${alerts.length ? alerts.join(' | ') : 'none'}`);
  });

  test('destination is required', { tag: [Tag.negative] }, async ({ hotelSearch }) => {
    const c = DataFactory.hotelSearch();
    await hotelSearch.dates.selectRange('Check-in', c.checkIn, 'Check-out', c.checkOut);
    await hotelSearch.searchButton.click();
    await expect(hotelSearch.page).toHaveURL(/\/hotels\/?$/);
  });

  test('past check-in dates cannot be selected', { tag: [Tag.boundary] }, async ({ hotelSearch }) => {
    await hotelSearch.dates.open('Check-in');
    expect(await hotelSearch.dates.canGoToPreviousMonth()).toBe(false);
    const yesterday = addDays(today(), -1);
    if (yesterday.getMonth() === today().getMonth()) expect(await hotelSearch.dates.isDayDisabled(yesterday)).toBe(true);
  });

  test('check-out cannot be on or before check-in', { tag: [Tag.boundary] }, async ({ hotelSearch }) => {
    const checkIn = futureDate(dateOffsets.hotelCheckInDays);
    await hotelSearch.dates.open('Check-in');
    await hotelSearch.dates.pick(checkIn);
    if (!(await hotelSearch.dates.isOpen())) await hotelSearch.dates.open('Check-out');
    expect(await hotelSearch.dates.isDayDisabled(addDays(checkIn, -1))).toBe(true);
    expect(await hotelSearch.dates.isDayDisabled(addDays(checkIn, 1))).toBe(false);
  });

  test('each child requires an age selection (0-17)', { tag: [Tag.boundary] }, async ({ hotelSearch }) => {
    await hotelSearch.guests.open();
    await hotelSearch.guests.setCount('child', 2);
    await expect(hotelSearch.guests.childAgeSelect(0)).toBeVisible();
    await expect(hotelSearch.guests.childAgeSelect(1)).toBeVisible();
    const options = await hotelSearch.guests.childAgeSelect(0).locator('option').allInnerTexts();
    expect(options[0].trim()).toBe('Under 1');
    expect(options[options.length - 1].trim()).toBe('17 years');
    await hotelSearch.guests.setCount('child', 1);
    await expect(hotelSearch.guests.childAgeSelect(1)).toBeHidden();
  });

  test('room and adult counters cannot go below one', { tag: [Tag.boundary] }, async ({ hotelSearch }) => {
    await hotelSearch.guests.open();
    await hotelSearch.guests.setCount('adult', 1);
    await expect(hotelSearch.guests.removeButton('adult')).toBeDisabled();
    await expect(hotelSearch.guests.removeButton('room')).toBeDisabled();
  });

  test('multi-room configuration is reflected in the summary', { tag: [Tag.positive] }, async ({ hotelSearch }) => {
    await hotelSearch.setGuests({ adults: 2, children: 0 }, 2);
    await expect(hotelSearch.guests.trigger).toHaveText('2 Adults, 2 Rooms');
  });
});
