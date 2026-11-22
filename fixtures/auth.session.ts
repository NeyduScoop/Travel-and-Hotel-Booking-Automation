import * as fs from 'fs';
import * as path from 'path';
import type { Browser, BrowserContext } from '@playwright/test';
import { environment, type Credentials } from '../config/environment.config';
import { LoginPage } from '../pages/common/LoginPage';

type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>;

const AUTH_DIR = path.resolve(__dirname, '..', 'playwright', '.auth');
const MAX_AGE_MS = 20 * 60_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One real sign-in per account, shared by all workers. Observed 2026-11-15: concurrent sign-ins to the
 * same PRIME account hang at "Signing in…", so creation is serialised with an atomic mkdir lock.
 * The state file holds session tokens and lives in the git-ignored playwright/.auth/ folder.
 */
export async function cachedSession(kind: 'prime' | 'affiliate', creds: Credentials, browser: Browser): Promise<StorageState> {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const file = path.join(AUTH_DIR, `${kind}.json`);
  const lock = `${file}.lock`;
  const fresh = () => fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs < MAX_AGE_MS;
  for (let waited = 0; ; waited += 2_000) {
    if (fresh()) return JSON.parse(fs.readFileSync(file, 'utf8')) as StorageState;
    try {
      fs.mkdirSync(lock);
      break;
    } catch {
      // A stale lock (crashed worker) is cleared after 5 minutes.
      if (fs.existsSync(lock) && Date.now() - fs.statSync(lock).mtimeMs > 300_000) fs.rmSync(lock, { recursive: true, force: true });
      if (waited > 300_000) throw new Error(`Timed out waiting for the shared ${kind} sign-in.`);
      await sleep(2_000); // waiting on another worker's sign-in (cross-process lock), not on the application
    }
  }
  try {
    if (fresh()) return JSON.parse(fs.readFileSync(file, 'utf8')) as StorageState;
    const context = await browser.newContext({ baseURL: environment.baseUrl });
    try {
      const login = new LoginPage(await context.newPage());
      if (kind === 'prime') {
        await login.openLogin();
        await login.login(creds.email, creds.password);
      } else {
        await login.openAffiliateLogin();
        await login.loginAsAffiliate(creds.email, creds.password);
      }
      const state = await context.storageState();
      fs.writeFileSync(file, JSON.stringify(state));
      return state;
    } finally {
      await context.close();
    }
  } finally {
    fs.rmSync(lock, { recursive: true, force: true });
  }
}

/** Load a cached session into the test's own (isolated) context: cookies + localStorage. */
export async function applySession(context: BrowserContext, state: StorageState): Promise<void> {
  await context.addCookies(state.cookies);
  await context.addInitScript((origins: StorageState['origins']) => {
    const entry = origins.find((o) => o.origin === window.location.origin);
    if (!entry) return;
    for (const { name, value } of entry.localStorage) {
      if (window.localStorage.getItem(name) === null) window.localStorage.setItem(name, value);
    }
  }, state.origins);
}
