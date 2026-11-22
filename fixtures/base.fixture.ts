import { test as base, type TestInfo } from '@playwright/test';
import { environment } from '../config/environment.config';
import { createLogger, redact, type Logger } from '../utils/logger';
import type { EnvironmentConfig } from '../types/common.types';

export interface Diagnostics {
  consoleErrors: string[];
  failedRequests: string[];
}

export interface BaseFixtures {
  env: EnvironmentConfig;
  logger: Logger;
  diagnostics: Diagnostics;
  /** Record a BLOCKED outcome (missing data/credentials/inventory) and stop the test as skipped. */
  blocked: (reason: string) => never;
  /** Record a non-blocking observation that will appear in the HTML report and summary. */
  observe: (description: string) => void;
}

/** Hosts whose failures are third-party noise, not Wakanow product behaviour. */
const THIRD_PARTY = /google|doubleclick|facebook|tiktok|clarity|hotjar|creativecdn|analytics|pulse\.wakanow|gstatic/i;

export function markBlocked(testInfo: TestInfo, reason: string): never {
  testInfo.annotations.push({ type: 'blocked', description: reason });
  testInfo.skip(true, `BLOCKED: ${reason}`);
  throw new Error('unreachable: testInfo.skip() aborts the test');
}

export const test = base.extend<BaseFixtures>({
  env: async ({}, use) => {
    await use(environment);
  },

  logger: async ({}, use, testInfo) => {
    await use(createLogger(testInfo.titlePath.slice(1).join(' > ')));
  },

  diagnostics: [
    async ({ page }, use, testInfo) => {
      const diagnostics: Diagnostics = { consoleErrors: [], failedRequests: [] };
      page.on('console', (msg) => {
        if (msg.type() === 'error') diagnostics.consoleErrors.push(redact(msg.text()).slice(0, 500));
      });
      page.on('pageerror', (err) => diagnostics.consoleErrors.push(`pageerror: ${redact(err.message).slice(0, 500)}`));
      page.on('response', (res) => {
        const url = res.url();
        if (res.status() >= 400 && !THIRD_PARTY.test(url)) {
          diagnostics.failedRequests.push(`${res.status()} ${res.request().method()} ${redact(url.split('?')[0])}`);
        }
      });
      await use(diagnostics);
      if (testInfo.status !== testInfo.expectedStatus && (diagnostics.consoleErrors.length || diagnostics.failedRequests.length)) {
        await testInfo.attach('console-and-network.json', {
          body: JSON.stringify(diagnostics, null, 2),
          contentType: 'application/json',
        });
      }
    },
    { auto: true },
  ],

  blocked: async ({}, use, testInfo) => {
    await use((reason: string) => markBlocked(testInfo, reason));
  },

  observe: async ({}, use, testInfo) => {
    await use((description: string) => {
      testInfo.annotations.push({ type: 'observation', description });
    });
  },
});

export { expect } from '@playwright/test';
