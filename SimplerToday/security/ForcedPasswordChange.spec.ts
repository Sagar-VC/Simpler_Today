import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';

/**
 * A01:2021 - Broken Access Control.
 *
 * QA verification for SIM-122 ("Enforce the forced password change on the
 * server, not only in the browser").
 *
 * The bug class: the app routes a flagged user to a change-password screen, but
 * the session it already handed out is fully valid — so navigating straight to
 * a protected page walks past the gate. The check is therefore not "does the
 * screen appear" but "can the gate be stepped around".
 *
 * REQUIRES an account flagged for a forced password change. Skips itself when
 * that account isn't configured, since the flag is cleared the moment anyone
 * actually changes the password and has to be re-set by an admin.
 */

const FORCED_EMAIL    = process.env.TEST_EMAIL_FORCE_PWD    ?? '';
const FORCED_PASSWORD = process.env.TEST_PASSWORD_FORCE_PWD ?? '';

const configured = Boolean(FORCED_EMAIL && FORCED_PASSWORD);

test.describe('Security - Forced password change (SIM-122)', () => {
  test('A flagged account is sent to the change-password screen', async ({ page }) => {
    test.skip(!configured, 'TEST_EMAIL_FORCE_PWD / TEST_PASSWORD_FORCE_PWD not set');

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(FORCED_EMAIL, FORCED_PASSWORD);

    // Match on the URL rather than on copy: the heading wording is a product
    // decision that may change, the route is the contract.
    await expect(
      page,
      'a flagged account was not routed to a password-change screen after sign-in'
    ).toHaveURL(/change-password|reset-password|update-password|force/i, { timeout: 20_000 });

    console.log('URL after sign-in with a flagged account:', page.url());
  });

  test('The change-password gate cannot be stepped around by navigating directly', async ({ page }) => {
    test.skip(!configured, 'TEST_EMAIL_FORCE_PWD / TEST_PASSWORD_FORCE_PWD not set');

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(FORCED_EMAIL, FORCED_PASSWORD);
    await expect(page).toHaveURL(/change-password|reset-password|update-password|force/i, { timeout: 20_000 });

    // The actual SIM-122 check: hold the session the app just issued and ask for
    // a protected page anyway. If the dashboard renders, the gate was only ever
    // a client-side redirect and the session is already fully privileged.
    await page.goto('/dashboard');

    await expect(
      page.getByRole('button', { name: 'New Workspace' }),
      'the dashboard rendered for an account that still owes a password change — ' +
        'the forced-change gate is client-side only (SIM-122)'
    ).toBeHidden({ timeout: 15_000 });

    await expect(
      page,
      'direct navigation to /dashboard was allowed to stay there despite a pending forced password change'
    ).not.toHaveURL(/\/dashboard/, { timeout: 15_000 });

    console.log('URL after forced /dashboard navigation:', page.url());
  });

  /**
   * Only /dashboard is probed, matching the precedent set in AccessControl.spec.ts:
   * guessing API route names that may not exist makes a pass or a fail equally
   * meaningless. The server-side half — calling a protected API directly with the
   * half-authenticated session and asserting a 401/403 — is worth adding here once
   * someone confirms one real endpoint path from the backend repo.
   */
});
