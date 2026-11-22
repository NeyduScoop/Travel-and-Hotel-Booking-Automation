import { test, expect, Tag, credentialSafeArtifacts } from '../../../fixtures/test.fixture';
import { invalidEmails, primeTiers } from '../../../data/prime/prime.data';
import { DataFactory } from '../../../utils/data.factory';
import { shortMonth, today } from '../../../utils/date.utils';

// Signed-in tests: no trace/video/screenshot, which could capture credentials (see CLAUDE.md).
test.use(credentialSafeArtifacts);

test.describe('Prime regression – membership plans and signup gate', { tag: [Tag.regression, Tag.prime] }, () => {
  for (const tier of primeTiers) {
    test(`${tier.heading}: join page tier, price and order summary match the plan`, { tag: [Tag.critical, Tag.positive] }, async ({ primeHome, primeMembership }) => {
      await primeHome.openPrime();
      const annual = await primeHome.annualPrice(tier);
      expect((await primeHome.benefits(tier)).length).toBeGreaterThan(0);
      await primeHome.joinLink(tier).click();
      await expect(primeMembership.page).toHaveURL(new RegExp(`/wakanow-prime/join/${tier.slug}$`));
      expect(await primeMembership.tierLabelMatches(tier)).toBe(true);
      const { subtotal, total, text } = await primeMembership.summaryAmounts();
      expect(subtotal).toBe(annual);
      expect(total).toBe(annual);
      const renews = new Date(today());
      renews.setFullYear(renews.getFullYear() + 1);
      expect(text).toContain(`Renews ${renews.getDate()} ${shortMonth(renews)} ${renews.getFullYear()}`);
    });

    test(`${tier.heading}: one traveller form per covered member`, { tag: [Tag.positive] }, async ({ primeMembership }) => {
      await primeMembership.openJoin(tier.slug);
      const covered = await primeMembership.coveredTravellers();
      expect(covered).toBeGreaterThan(0);
      await expect(primeMembership.travellerHeadings).toHaveCount(covered);
      await expect(primeMembership.main.getByRole('textbox', { name: 'First name', exact: true })).toHaveCount(covered);
    });
  }

  test('higher tiers are priced above lower tiers', { tag: [Tag.positive] }, async ({ primeHome }) => {
    await primeHome.openPrime();
    const prices = await Promise.all(primeTiers.map((t) => primeHome.annualPrice(t)));
    expect(prices[0]).toBeLessThan(prices[1]);
    expect(prices[1]).toBeLessThan(prices[2]);
  });

  for (const email of invalidEmails) {
    test(`signup email gate rejects "${email}"`, { tag: [Tag.negative] }, async ({ primeMembership }) => {
      await primeMembership.openJoin('Single');
      await primeMembership.gateEmail.fill(email);
      await expect(primeMembership.gateContinue).toBeDisabled();
    });
  }

  test('signup email gate accepts a valid email (not submitted)', { tag: [Tag.positive] }, async ({ primeMembership }) => {
    await primeMembership.openJoin('Duo');
    await expect(primeMembership.gateContinue).toBeDisabled();
    await primeMembership.gateEmail.fill(DataFactory.uniqueEmail());
    await expect(primeMembership.gateContinue).toBeEnabled();
  });

  test('"Back to plans" returns to the Prime landing page', { tag: [Tag.positive] }, async ({ primeMembership, primeHome }) => {
    await primeMembership.openJoin('Corporate');
    await primeMembership.backToPlans.click();
    await expect(primeMembership.page).toHaveURL(/\/wakanow-prime\/?$/);
    await expect(primeHome.heroHeading).toBeVisible();
  });

  test('login page requires a valid email before continuing', { tag: [Tag.negative] }, async ({ loginPage }) => {
    await loginPage.openLogin();
    await expect(loginPage.continueButton).toBeDisabled();
    await loginPage.enterEmail('not-an-email');
    await expect(loginPage.continueButton).toBeDisabled();
    await loginPage.enterEmail(DataFactory.uniqueEmail());
    await expect(loginPage.continueButton).toBeEnabled();
  });

  test('PRIME member can sign in and is no longer offered "Log in/Sign up"', { tag: [Tag.critical, Tag.positive] }, async ({ primeAccount, loginPage, navigation }) => {
    await loginPage.openLogin();
    await loginPage.login(primeAccount.email, primeAccount.password);
    await navigation.openHome();
    await expect(navigation.loginButton).toBeHidden();
  });
});
