import { defineConfig } from '@playwright/test';
import { environment } from './config/environment.config';
import { browserProjects } from './config/browser.config';
import { execution, timeouts } from './config/test.config';
import { isCI, readBoolEnv } from './utils/environment.utils';

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results/artifacts',
  timeout: timeouts.test,
  expect: { timeout: timeouts.expect },
  fullyParallel: true,
  forbidOnly: isCI,
  retries: execution.retries,
  workers: execution.workers,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['./reporters/summary-reporter.ts', { outputDir: 'test-results' }],
  ],
  use: {
    baseURL: environment.baseUrl,
    headless: readBoolEnv('HEADLESS', true),
    actionTimeout: timeouts.action,
    navigationTimeout: timeouts.navigation,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: isCI ? 'on-first-retry' : 'retain-on-failure',
    locale: 'en-NG',
    timezoneId: 'Africa/Lagos',
  },
  metadata: {
    environment: environment.name,
    baseUrl: environment.baseUrl,
  },
  projects: browserProjects,
});
