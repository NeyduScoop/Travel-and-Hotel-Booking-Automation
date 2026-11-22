import type { Locator } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { affiliateData } from '../../data/affiliate/affiliate.data';

/**
 * Affiliate session behaviour (DEVTEST, 2026-11-15). After /auth/affiliate sign-in the session lives in
 * localStorage `wk_affiliate_agent` (plus the `wk_access_token` cookie). The header keeps showing
 * "Log in/Sign up" and the implied dashboard routes return 404, so affiliate identity is verified
 * through the stored session and, where present, through booking API data — never through an
 * invented dashboard.
 */
export class AffiliateSessionPage extends BasePage {
  get loginSignupButton(): Locator {
    return this.header.getByRole('button', { name: 'Log in/Sign up' });
  }
  get myAccountLink(): Locator {
    return this.header.getByRole('link', { name: 'My account' });
  }

  async sessionStored(): Promise<boolean> {
    return this.page.evaluate((key) => Boolean(window.localStorage.getItem(key)), affiliateData.sessionStorageKey);
  }

  /** Names of the properties held in the stored affiliate session (values are never read out). */
  async sessionFieldNames(): Promise<string[]> {
    return this.page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? Object.keys(parsed) : ['<non-object>'];
      } catch {
        return ['<non-json>'];
      }
    }, affiliateData.sessionStorageKey);
  }

  async hasAccessTokenCookie(): Promise<boolean> {
    return (await this.page.context().cookies()).some((c) => c.name === 'wk_access_token');
  }

  /** HTTP-level result of each implied dashboard route (final URL after client routing). */
  async dashboardRouteResults(): Promise<{ path: string; finalUrl: string; heading: string }[]> {
    const out: { path: string; finalUrl: string; heading: string }[] = [];
    for (const path of affiliateData.impliedDashboardPaths) {
      await this.goto(path);
      const heading = (await this.main.getByRole('heading', { level: 1 }).first().innerText().catch(() => '')).trim();
      out.push({ path, finalUrl: this.page.url(), heading });
    }
    return out;
  }
}
