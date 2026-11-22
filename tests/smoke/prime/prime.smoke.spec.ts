import { test, expect, Tag } from '../../../fixtures/test.fixture';
import { primeTiers } from '../../../data/prime/prime.data';
import { DataFactory } from '../../../utils/data.factory';

test.describe('Prime smoke', { tag: [Tag.smoke, Tag.prime] }, () => {
  test('Prime module loads with three membership tiers', { tag: [Tag.critical, Tag.positive] }, async ({ primeHome }) => {
    await primeHome.openPrime();
    await expect(primeHome.joinPrimeButton).toBeVisible();
    for (const tier of primeTiers) {
      await expect(primeHome.tierHeading(tier)).toBeVisible();
      await expect(primeHome.joinLink(tier)).toHaveAttribute('href', `/wakanow-prime/join/${tier.slug}`);
      expect(await primeHome.annualPrice(tier)).toBeGreaterThan(0);
    }
  });

  test('membership information (benefits and FAQ) is accessible', { tag: [Tag.positive] }, async ({ primeHome }) => {
    await primeHome.openPrime();
    expect((await primeHome.benefits(primeTiers[0])).length).toBeGreaterThan(0);
    await expect(primeHome.faqHeading).toBeVisible();
    expect(await primeHome.serviceArticles.count()).toBeGreaterThan(0);
  });

  test('join action opens the tier signup with an email gate', { tag: [Tag.critical, Tag.positive] }, async ({ primeHome, primeMembership }) => {
    await primeHome.openPrime();
    await primeHome.joinLink(primeTiers[0]).click();
    await expect(primeMembership.page).toHaveURL(/\/wakanow-prime\/join\/Single/);
    await expect(primeMembership.heading).toContainText('Individual');
    await expect(primeMembership.emailGate).toBeVisible();
    await expect(primeMembership.gateContinue).toBeDisabled();
    await primeMembership.gateEmail.fill(DataFactory.uniqueEmail());
    await expect(primeMembership.gateContinue).toBeEnabled();
  });
});
