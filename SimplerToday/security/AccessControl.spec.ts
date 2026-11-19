import { test, expect } from '@playwright/test';

/**
 * A01:2021 - Broken Access Control
 *
 * Forced-browsing check: an unauthenticated browser must never reach an
 * authenticated page by navigating directly to its URL — it must be
 * redirected to /login instead of rendering protected content.
 *
 * Only /dashboard is checked here — it's the one protected route confirmed
 * by the rest of the suite (see DashboardPage.verifyDashboardURL). Add more
 * paths here as their exact URLs are confirmed elsewhere (e.g. a workspace
 * URL captured by security/IDOR.spec.ts) rather than guessing route names
 * that may not exist, which would make a pass/fail meaningless.
 */
test.describe('Security - Broken Access Control (unauthenticated forced browsing)', () => {
  test('Direct navigation to /dashboard without a session redirects to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
