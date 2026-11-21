import { defineConfig, devices } from '@playwright/test';

/**
 * Live end-to-end tests: the real app and `/api` functions (`vercel dev --local`, port 3000)
 * against the Supabase test project. Reads `.env` (git-ignored) for the server's keys and the test
 * user. Specs skip themselves when E2E_USER_EMAIL / E2E_USER_PASSWORD are missing.
 */
try {
  process.loadEnvFile('.env');
} catch {
  // No .env (e.g. CI writes the variables into the environment instead).
}

const PORT = 3000;

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.live.spec.ts',
  // One user, one session table: run in order so sign-outs don't race sign-ins.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-live' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'mobile-390', use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: 'npm run dev:full',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
