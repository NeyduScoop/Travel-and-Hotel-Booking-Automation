import { expect, type Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Login (/auth) and affiliate login (/auth/affiliate). All steps verified on DEVTEST 2026-11-15:
 *  Customer / PRIME: "Email Address" -> "Continue" (POST Account/EmailVerification) ->
 *    "Enter your password" step ("Password", "Sign in", "Email me a code instead", "Forgot password?")
 *    -> "You're signed in" + "Continue to Wakanow"; header then shows link "My account" (with PRIME badge).
 *  Affiliate: "Login as an Affiliate" -> /auth/affiliate: "Affiliate ID or email", "Password",
 *    "Sign in" (disabled until both are filled) -> POST api/affiliate/login -> "You're signed in".
 *    The affiliate session is held in storage (`wk_affiliate_agent`); the header does not change.
 */
export class LoginPage extends BasePage {
  get heading(): Locator {
    return this.main.getByRole('heading', { name: 'Welcome back', level: 1 });
  }
  get emailInput(): Locator {
    return this.main.getByRole('textbox', { name: 'Email Address' });
  }
  get continueButton(): Locator {
    return this.main.getByRole('button', { name: 'Continue', exact: true });
  }
  get microsoftButton(): Locator {
    return this.main.getByRole('button', { name: 'Sign in with Microsoft' });
  }
  get affiliateButton(): Locator {
    return this.main.getByRole('button', { name: 'Login as an Affiliate' });
  }
  get passwordHeading(): Locator {
    return this.main.getByRole('heading', { name: 'Enter your password', level: 2 });
  }
  get passwordInput(): Locator {
    return this.main.getByRole('textbox', { name: 'Password', exact: true });
  }
  get signInButton(): Locator {
    return this.main.getByRole('button', { name: 'Sign in', exact: true });
  }
  get emailCodeButton(): Locator {
    return this.main.getByRole('button', { name: 'Email me a code instead' });
  }
  get forgotPasswordButton(): Locator {
    return this.main.getByRole('button', { name: 'Forgot password?' });
  }
  get signedInHeading(): Locator {
    return this.main.getByRole('heading', { name: "You're signed in", level: 2 });
  }
  get continueToWakanow(): Locator {
    return this.main.getByRole('button', { name: 'Continue to Wakanow' });
  }
  get myAccountLink(): Locator {
    return this.header.getByRole('link', { name: 'My account' });
  }
  get loginSignupButton(): Locator {
    return this.header.getByRole('button', { name: 'Log in/Sign up' });
  }

  // Affiliate screen
  get affiliateHeading(): Locator {
    return this.main.getByRole('heading', { name: 'Affiliate partners', level: 1 });
  }
  get affiliateIdInput(): Locator {
    return this.main.getByRole('textbox', { name: 'Affiliate ID or email' });
  }
  get customerLoginButton(): Locator {
    return this.main.getByRole('button', { name: '← Customer login' });
  }

  async openLogin(): Promise<void> {
    await this.open('/auth');
    await expect(this.heading).toBeVisible();
  }

  async enterEmail(email: string): Promise<void> {
    await this.emailInput.fill(email);
  }

  /** Customer / PRIME sign-in through to "Continue to Wakanow". */
  async login(email: string, password: string): Promise<void> {
    // Input typed before Angular hydration is discarded; re-type until "Continue" accepts it.
    await expect(async () => {
      await this.enterEmail(email);
      await expect(this.continueButton).toBeEnabled({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
    await this.continueButton.click();
    await expect(this.passwordHeading).toBeVisible({ timeout: 30_000 });
    await this.passwordInput.fill(password);
    await this.signInButton.click();
    // "Signing in…" was observed to take over a minute when several sessions sign in concurrently.
    await expect(this.signedInHeading).toBeVisible({ timeout: 150_000 });
    await this.continueToWakanow.click();
    await expect(this.page).not.toHaveURL(/\/auth/, { timeout: 30_000 });
    await expect(this.myAccountLink).toBeVisible({ timeout: 30_000 });
  }

  async openAffiliateLogin(): Promise<void> {
    await this.openLogin();
    await this.affiliateButton.click();
    await expect(this.page).toHaveURL(/\/auth\/affiliate/);
    await expect(this.affiliateHeading).toBeVisible();
  }

  /** Affiliate sign-in through to "Continue to Wakanow". */
  async loginAsAffiliate(id: string, password: string): Promise<void> {
    await this.affiliateIdInput.fill(id);
    await this.passwordInput.fill(password);
    await expect(this.signInButton).toBeEnabled();
    const login = this.page.waitForResponse((r) => /\/api\/affiliate\/login/i.test(r.url()), { timeout: 60_000 });
    await this.signInButton.click();
    const response = await login;
    expect(response.status(), 'affiliate login API status').toBe(200);
    await expect(this.signedInHeading).toBeVisible({ timeout: 60_000 });
    await this.continueToWakanow.click();
    await expect(this.page).not.toHaveURL(/\/auth/, { timeout: 30_000 });
  }

  /** Affiliate identity is held in localStorage `wk_affiliate_agent` (no UI indicator exists). */
  async affiliateAgentStored(): Promise<boolean> {
    return this.page.evaluate(() => Boolean(window.localStorage.getItem('wk_affiliate_agent')));
  }

  /** Customer identity is held in localStorage `wk_user`. */
  async customerUserStored(): Promise<boolean> {
    return this.page.evaluate(() => Boolean(window.localStorage.getItem('wk_user')));
  }
}
