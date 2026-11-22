import { test, expect, Tag, credentialSafeArtifacts } from '../../../fixtures/test.fixture';

// Signed-in tests: no trace/video/screenshot, which could capture credentials (see CLAUDE.md).
test.use(credentialSafeArtifacts);

test.describe('Affiliate regression', { tag: [Tag.regression, Tag.affiliate] }, () => {
  // Uses an unregistered affiliate ID so repeated runs can never lock the real affiliate account.
  test('invalid affiliate credentials are rejected and no session is stored', { tag: [Tag.negative, Tag.critical] }, async ({ loginPage, affiliateSession, page }) => {
    await loginPage.openAffiliateLogin();
    await loginPage.affiliateIdInput.fill('WK-AFF-0000-QA-INVALID');
    await loginPage.passwordInput.fill('definitely-not-the-password-1!');
    const login = page.waitForResponse((r) => /\/api\/affiliate\/login/i.test(r.url()));
    await loginPage.signInButton.click();
    expect((await login).status(), 'affiliate login API rejects a wrong password').not.toBe(200);
    await expect(loginPage.signedInHeading).toBeHidden();
    expect(await affiliateSession.sessionStored()).toBe(false);
  });

  test('affiliate session is retained across navigation and reload', { tag: [Tag.critical, Tag.positive] }, async ({ signedInAffiliate, affiliateSession, page }) => {
    void signedInAffiliate;
    for (const path of ['/flights', '/extras', '/hotels']) {
      await affiliateSession.goto(path);
      expect(await affiliateSession.sessionStored(), `affiliate session on ${path}`).toBe(true);
    }
    await page.reload();
    expect(await affiliateSession.sessionStored()).toBe(true);
  });

  test('a signed-in affiliate is recognised in the interface', { tag: [Tag.negative] }, async ({ signedInAffiliate, affiliateSession, observe }) => {
    void signedInAffiliate;
    observe(`Affiliate session fields: ${(await affiliateSession.sessionFieldNames()).join(', ')}`);
    // An affiliate is not a customer account: the header still offers "Log in/Sign up" and no affiliate indicator exists.
    await expect(affiliateSession.myAccountLink).toBeHidden();
    await expect(affiliateSession.loginSignupButton, 'header should reflect the signed-in affiliate (NEEDS CLARIFICATION: no affiliate indicator exists)').toBeHidden();
  });

  test('the affiliate dashboard promised on the login page exists', { tag: [Tag.negative] }, async ({ signedInAffiliate, affiliateSession, observe }) => {
    void signedInAffiliate;
    const results = await affiliateSession.dashboardRouteResults();
    observe(`Affiliate dashboard routes: ${results.map((r) => `${r.path} -> ${r.finalUrl} "${r.heading}"`).join('; ')}`);
    expect(results.some((r) => !/\/404|Page Not Found/i.test(`${r.finalUrl} ${r.heading}`)), 'at least one affiliate dashboard route').toBe(true);
  });
});
