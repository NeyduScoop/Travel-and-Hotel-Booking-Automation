/**
 * Affiliate behaviour observed on DEVTEST (2026-11-15). Credentials come only from
 * AFFILIATE_EMAIL / AFFILIATE_PASSWORD.
 */
export const affiliateData = {
  loginPath: '/auth/affiliate',
  /** localStorage key that holds the affiliate session after sign-in. */
  sessionStorageKey: 'wk_affiliate_agent',
  /** Routes the login page implies ("affiliate dashboard") that return 404 on DEVTEST. */
  impliedDashboardPaths: ['/affiliate', '/affiliate/dashboard'],
} as const;
