import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';

/**
 * A07:2021 - Identification and Authentication Failures.
 *
 * QA verification for SIM-124 ("ADMIN_MFA_ENFORCE: enforce unless explicitly
 * false"). After the fix, a platform admin can never get a session from a
 * password alone: the server answers sign-in with the two-step verification
 * step (enrolment for an admin who hasn't set it up yet, the code otherwise).
 *
 * This checks the outcome on the environment under test — it cannot read the
 * flag itself. `false` is the only value that turns enforcement off, so an
 * environment that deliberately sets ADMIN_MFA_ENFORCE=false fails here by
 * design.
 *
 * Enrolment is blocked on purpose. For an admin who hasn't enrolled, the app
 * calls /api/auth/mfa/enrol straight after the password, which mints a new
 * authenticator secret and shows it (QR code and setup key) on screen. Aborting
 * that call keeps secrets out of the run, its screenshots and its trace, and
 * leaves the account's MFA state untouched.
 */

const ADMIN_EMAIL    = process.env.TEST_EMAIL_PLATFORM_ADMIN    ?? '';
const ADMIN_PASSWORD = process.env.TEST_PASSWORD_PLATFORM_ADMIN ?? '';

test.describe('Security - Admin MFA enforcement (SIM-124)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'TEST_EMAIL_PLATFORM_ADMIN / TEST_PASSWORD_PLATFORM_ADMIN not set');
    await page.route('**/api/auth/mfa/enrol', route => route.abort());
  });

  test('A platform admin password sign-in is answered with the MFA step, not a session', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    const loginResponse = page.waitForResponse(
      res => res.url().includes('/api/auth/login') && res.request().method() === 'POST'
    );
    await loginPage.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const { data } = await (await loginResponse).json();

    // Server side — the actual SIM-124 check: no session for a password alone.
    expect(data?.mfaRequired, 'the server signed a platform admin in on a password alone — MFA is not enforced (SIM-124)').toBe(true);
    expect(data?.accessToken, 'an access token was issued before the MFA step was completed').toBeUndefined();
    console.log(`MFA step required by the server: scope "${data?.mfaScope}"`);

    // UI side — the admin lands on the two-step verification screen.
    await expect(page.getByRole('heading', { name: 'Two-step verification' })).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole('button', { name: 'New Workspace' }),
      'the dashboard rendered for a platform admin who has not completed MFA'
    ).toBeHidden();
  });

  test('The dashboard cannot be reached before the MFA step is completed', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(page.getByRole('heading', { name: 'Two-step verification' })).toBeVisible({ timeout: 15_000 });

    // Navigating straight to a protected page must not walk past the MFA step.
    await page.goto('/dashboard');
    await expect(page, 'a platform admin reached the dashboard without completing MFA').toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
