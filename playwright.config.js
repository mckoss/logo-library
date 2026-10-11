// End-to-end tests of the package in the demo host pages, which emulate how
// mckoss.com embeds it (see demo/). They're served from demo/site/, so run
// `npm test`, which builds the package and the hosts first; the examples
// test also reads the built playground page from there.
import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PORT) || 8790;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [{
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      // PW_CHROMIUM_EXECUTABLE runs another Chromium than the one this
      // Playwright version downloads (for machines with browsers preinstalled).
      ...(process.env.PW_CHROMIUM_EXECUTABLE
        ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_EXECUTABLE } } : {}),
    },
  }],
  webServer: {
    command: 'npm run serve',
    env: { PORT: String(port) },
    url: `http://localhost:${port}/logo/`,
    reuseExistingServer: !process.env.CI,
  },
});
