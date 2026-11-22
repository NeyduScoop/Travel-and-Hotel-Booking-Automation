import { test, expect, Tag, credentialSafeArtifacts } from '../../../fixtures/test.fixture';
import { DataFactory } from '../../../utils/data.factory';
import { timeouts } from '../../../config/test.config';

// Signed-in tests: no trace/video/screenshot, which could capture credentials (see CLAUDE.md).
test.use(credentialSafeArtifacts);

test.describe('PRIME authentication smoke', { tag: [Tag.smoke, Tag.prime] }, () => {
  test('login readiness: email-first step leads to the password step', { tag: [Tag.critical, Tag.positive] }, async ({ loginPage, primeAccount }) => {
    await loginPage.openLogin();
    await loginPage.enterEmail(primeAccount.email);
    await loginPage.continueButton.click();
    await expect(loginPage.passwordHeading).toBeVisible({ timeout: 30_000 });
    await expect(loginPage.passwordInput).toBeEditable();
    await expect(loginPage.signInButton).toBeVisible();
  });

  test('PRIME member signs in through the UI and gets the PRIME badge', { tag: [Tag.critical, Tag.positive] }, async ({ loginPage, primeAccount, primeBooking }) => {
    test.setTimeout(timeouts.bookingFlow);
    await loginPage.openLogin();
    await loginPage.login(primeAccount.email, primeAccount.password);
    await expect(primeBooking.memberBadge).toBeVisible();
  });

  test('cached PRIME session is recognised (used by the other PRIME tests)', { tag: [Tag.positive] }, async ({ signedInPrime, primeBooking }) => {
    void signedInPrime;
    await expect(primeBooking.memberBadge).toBeVisible();
  });

  test('PRIME Flights access: member fares and "Book with Prime" are offered', { tag: [Tag.primeFlights, Tag.critical] }, async ({ signedInPrime, flightResults, blocked }) => {
    void signedInPrime;
    test.setTimeout(timeouts.bookingFlow);
    await flightResults.openFor(DataFactory.oneWayFlight());
    if ((await flightResults.waitForOutcome()).kind === 'empty') blocked('MISSING INVENTORY');
    const card = flightResults.card(0);
    await expect(card.getByRole('button', { name: 'Book with Prime' })).toBeVisible();
    expect(await flightResults.primePriceOf(card)).toBeGreaterThan(0);
  });

  test('PRIME Hotels access: hotel results load for a signed-in member', { tag: [Tag.primeHotels, Tag.critical] }, async ({ signedInPrime, hotelSearch, hotelResults, primeBooking }) => {
    void signedInPrime;
    test.setTimeout(timeouts.bookingFlow);
    await hotelSearch.openSearch();
    await hotelSearch.search(DataFactory.hotelSearch());
    await hotelResults.waitForOutcome();
    await expect(primeBooking.memberBadge).toBeVisible();
  });
});
