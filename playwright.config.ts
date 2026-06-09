import playwright from '@playwright/test';

const { defineConfig, devices } = playwright;

const port = Number.parseInt(process.env.PLAYWRIGHT_PORT ?? '9001', 10);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === 'true';
const desktopChrome = {
  ...devices['Desktop Chrome'],
  deviceScaleFactor: 1,
  viewport: { height: 720, width: 1280 },
};

export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  outputDir: './artifacts/playwright/test-results',
  projects: [
    {
      name: 'chromium',
      use: {
        ...desktopChrome,
      },
    },
    {
      name: 'profile-chromium',
      use: {
        ...desktopChrome,
        launchOptions: {
          args: [
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=CalculateNativeWinOcclusion',
          ],
        },
        screenshot: 'off',
        trace: 'off',
        video: 'off',
      },
    },
  ],
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: './artifacts/playwright/html-report' }],
  ],
  testDir: './playwright/tests',
  timeout: 90_000,
  use: {
    baseURL,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  webServer: skipWebServer
    ? undefined
    : {
        command: `pnpm dev -- --host 127.0.0.1 --port ${port}`,
        reuseExistingServer: true,
        timeout: 120_000,
        url: baseURL,
      },
});
