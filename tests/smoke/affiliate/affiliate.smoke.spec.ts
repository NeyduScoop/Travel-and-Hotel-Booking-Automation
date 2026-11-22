import { test, expect, Tag, credentialSafeArtifacts } from '../../../fixtures/test.fixture';

// Signed-in tests: no trace/video/screenshot, which could capture credentials (see CLAUDE.md).
test.use(credentialSafeArtifacts);

test.describe('Affiliate smoke', { tag: [Tag.smoke, Tag.affiliate] }, () => {
  test('affiliate login screen is reachable and its form gates submission', { tag: [Tag.critical, Tag.positive] }, async ({ loginPage }) => {
    await loginPage.openAffiliateLogin();
    await expect(loginPage.affiliateIdInput).toBeEditable();
    await expect(loginPage.passwordInput).toBeEditable();
    await expect(loginPage.signInButton).toBeDisabled();
    await expect(loginPage.customerLoginButton).toBeVisible();
  });

  test('affiliate can sign in and the affiliate session is stored', { tag: [Tag.critical, Tag.positive] }, async ({ signedInAffiliate, affiliateSession }) => {
    void signedInAffiliate;
    expect(await affiliateSession.sessionStored()).toBe(true);
    expect(await affiliateSession.hasAccessTokenCookie()).toBe(true);
  });
});
