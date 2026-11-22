import { devices, type Project } from '@playwright/test';

const desktopViewport = { width: 1440, height: 900 };

/** Browser projects. Chromium is the primary execution target; Firefox/WebKit run the smoke suite cross-browser. */
export const browserProjects: Project[] = [
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], viewport: desktopViewport },
  },
  {
    name: 'firefox',
    use: { ...devices['Desktop Firefox'], viewport: desktopViewport },
  },
  {
    name: 'webkit',
    use: { ...devices['Desktop Safari'], viewport: desktopViewport },
  },
];
