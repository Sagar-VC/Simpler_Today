import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

/**
 * Load environment variables from .env (credentials, etc.).
 * https://github.com/motdotla/dotenv
 */
dotenv.config({ path: path.resolve(__dirname, '.env') });

// ── Environment map ────────────────────────────────────────────────────────
const environments = {
  dev:     'https://demo.pracsys.simplertoday.ai/login',
  staging: 'https://staging.pracsys.simplertoday.ai/login',
  prod:    'https://prod.pracsys.simplertoday.ai/login',
};

/**
 * If BASE_URL is set (e.g. via npm scripts), use that environment only.
 * Otherwise run against all environments.
 */
function getEnvironments(): Record<string, string> {
  const baseUrl = process.env.BASE_URL;
  if (baseUrl) {
    const envName = Object.keys(environments).find(
      key => environments[key as keyof typeof environments] === baseUrl
    );
    return envName ? { [envName]: baseUrl } : { custom: baseUrl };
  }
  return environments;
}

const activeEnvironments = getEnvironments();

// ── Playwright config ──────────────────────────────────────────────────────
// See https://playwright.dev/docs/test-configuration.
export default defineConfig({
  testDir: './SimplerToday',
  testMatch: ['**/*.spec.ts'],

  /* Run tests sequentially (one after another) */
  fullyParallel: false,

  /* Fail the build on CI if test.only is accidentally committed */
  forbidOnly: !!process.env.CI,

  /* Retry on CI; also retry once locally to recover from transient browser crashes */
  retries: process.env.CI ? 2 : 1,

  /* Single worker so tests run one at a time */
  workers: 1,

  /* Reporters */
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],

  /* Shared settings for all projects */
  use: {
    trace:      'on',
    headless:   false,
    screenshot: 'on',
    video:      'on',
    launchOptions: {
      slowMo: 500,
      args: ['--no-sandbox'],
    },
  },

  /* One Chromium project per active environment */
  projects: Object.entries(activeEnvironments).map(([envName, url]) => ({
    name: `chromium-${envName}`,
    use: {
      ...devices['Desktop Chrome'],
      baseURL: url,
    },
  })),

  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
