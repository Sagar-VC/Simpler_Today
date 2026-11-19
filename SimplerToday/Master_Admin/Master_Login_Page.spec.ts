import { test, expect, Page } from '@playwright/test';
import { MasterAdminLoginPage } from '../../pages/MasterAdminLoginPage';
import { countRequests } from '../../utils/countRequests';
import { generateTotp, msUntilNextTotpWindow } from '../../utils/totp';
import { RecoveryCodes } from '../../utils/recoveryCodes';

/**
 * Master Admin sign-in on the admin console (ADMIN_URL).
 *
 * Sign-in has two steps: email + password, then a code from the authenticator
 * app. A correct password alone never signs the admin in.
 *
 * The full sign-in (code → dashboard → sign out) uses, in order of preference:
 *   1. TEST_TOTP_SECRET_MASTER_ADMIN — the account's authenticator secret (the
 *      base32 key shown when MFA was set up). Reusable, so preferred.
 *   2. TEST_MFA_RECOVERY_CODES_MASTER_ADMIN — single-use recovery codes. Each
 *      run spends one; used codes are recorded in .auth/ and the last 2 are
 *      never used (see utils/recoveryCodes.ts). Top the list up when it runs low.
 * With neither available the full sign-in test is skipped.
 */

// ── Credentials and URL from environment variables (.env file)
// Never commit real values — see .env.example for the required keys.
const ADMIN_URL      = process.env.ADMIN_URL                     ?? '';
const ADMIN_EMAIL    = process.env.TEST_EMAIL_MASTER_ADMIN       ?? '';
const ADMIN_PASSWORD = process.env.TEST_PASSWORD_MASTER_ADMIN    ?? '';
const TOTP_SECRET    = process.env.TEST_TOTP_SECRET_MASTER_ADMIN ?? '';
const RECOVERY_CODES = new RecoveryCodes(process.env.TEST_MFA_RECOVERY_CODES_MASTER_ADMIN ?? '', 'master-admin-recovery-codes');

/** The sign-in request (email + password) */
const LOGIN = /\/api\/admin\/auth\/login$/;

/** The current authenticator code, waiting out the last seconds of a window so it can't expire in flight. */
async function currentCode(page: Page): Promise<string> {
  if (msUntilNextTotpWindow() < 3_000) await page.waitForTimeout(msUntilNextTotpWindow() + 500);
  return generateTotp(TOTP_SECRET);
}

let loginPage: MasterAdminLoginPage;

test.beforeEach(async ({ page }) => {
  test.skip(!ADMIN_URL, 'ADMIN_URL not set in .env');
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'TEST_EMAIL_MASTER_ADMIN / TEST_PASSWORD_MASTER_ADMIN not set in .env');
  // Guard: never let a run start MFA setup, which would create and show a new secret
  await page.route(/\/mfa\/enrol/, route => route.abort());

  loginPage = new MasterAdminLoginPage(page, ADMIN_URL);
  await loginPage.goto();
});

// ──────────────────────────────────────────────────────────────
// ✅  POSITIVE SCENARIOS
// ──────────────────────────────────────────────────────────────
test.describe('Master Admin Login - Positive Scenarios', () => {
  test('Show password reveals the password and Hide password masks it again', async () => {
    await loginPage.fillPassword('Visible123');

    await loginPage.showPasswordButton.click();
    await expect(loginPage.passwordField).toHaveAttribute('type', 'text');

    await loginPage.hidePasswordButton.click();
    await expect(loginPage.passwordField).toHaveAttribute('type', 'password');
  });

  test('Valid credentials lead to two-step verification, not straight in', async () => {
    const response = await loginPage.loginAndWaitForResponse(ADMIN_EMAIL, ADMIN_PASSWORD);
    const { data } = await response.json();

    // Server: the password is accepted, but no session is issued before the code
    expect(response.status()).toBe(200);
    expect(data?.mfaRequired, 'the server signed the Master Admin in on a password alone').toBe(true);
    expect(data?.accessToken, 'an access token was issued before two-step verification').toBeUndefined();

    // Page: the code step is shown, not the dashboard
    await expect(loginPage.twoStepHeading).toBeVisible({ timeout: 15_000 });
    await expect(loginPage.codeField).toBeVisible();
    await expect(loginPage.verifyButton).toBeVisible();
  });

  test('"Use a different account" returns to the sign-in form', async () => {
    await loginPage.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(loginPage.twoStepHeading).toBeVisible({ timeout: 15_000 });

    await loginPage.useDifferentAccountButton.click();

    await expect(loginPage.signInHeading).toBeVisible({ timeout: 10_000 });
    await expect(loginPage.emailField).toBeVisible();
    await expect(loginPage.twoStepHeading).toBeHidden();
  });

  test.describe('Full sign-in', () => {
    // With a recovery code, a failed attempt has already used its code up —
    // don't spend another one on a retry.
    test.describe.configure({ retries: 0 });

    test('Verification code signs in to the dashboard, and Sign out ends the session', async ({ page }) => {
      test.skip(
        !TOTP_SECRET && !RECOVERY_CODES.available(),
        RECOVERY_CODES.paused()
          ? 'Recovery codes paused: one was refused (probably already used). Put unused codes in ' +
              'TEST_MFA_RECOVERY_CODES_MASTER_ADMIN, or set TEST_TOTP_SECRET_MASTER_ADMIN'
          : `No way to pass two-step verification: set TEST_TOTP_SECRET_MASTER_ADMIN, or add fresh codes to ` +
              `TEST_MFA_RECOVERY_CODES_MASTER_ADMIN (${RECOVERY_CODES.remaining()} unused left, ${RECOVERY_CODES.reserve} kept in reserve)`
      );

      await loginPage.login(ADMIN_EMAIL, ADMIN_PASSWORD);
      await expect(loginPage.codeField).toBeVisible({ timeout: 15_000 });

      // Prefer the authenticator secret; a recovery code is spent by this sign-in
      const code = TOTP_SECRET ? await currentCode(page) : RECOVERY_CODES.take();
      if (!TOTP_SECRET) {
        console.log(`Using a recovery code: ${RECOVERY_CODES.remaining()} unused left (${RECOVERY_CODES.reserve} kept in reserve)`);
      }

      const response = await loginPage.verifyCode(code);
      if (!TOTP_SECRET && response.status() !== 200) RECOVERY_CODES.markRefused();
      expect(
        response.status(),
        TOTP_SECRET
          ? 'the authenticator code was refused'
          : 'the recovery code was refused (probably already used) — recovery codes are now paused until the list in .env is updated'
      ).toBe(200);

      await expect(page.getByText(/welcome back/i)).toBeVisible({ timeout: 20_000 });
      await expect(loginPage.dashboardHeading).toBeVisible();

      await loginPage.signOut();
      await expect(loginPage.signInHeading).toBeVisible({ timeout: 15_000 });

      // The session is gone: the dashboard sends the user back to sign in
      await page.goto(new URL('/dashboard', ADMIN_URL).href);
      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    });
  });
});

// ──────────────────────────────────────────────────────────────
// ❌  NEGATIVE SCENARIOS
// ──────────────────────────────────────────────────────────────
test.describe('Master Admin Login - Negative Scenarios', () => {
  test('Empty Email and Password', async ({ page }) => {
    const loginRequests = countRequests(page, 'POST', LOGIN);
    await loginPage.clickSignIn();

    await expect(loginPage.fieldError('Email is required')).toBeVisible();
    await expect(loginPage.fieldError('Password is required')).toBeVisible();
    expect(loginRequests(), 'the form was submitted with empty fields').toBe(0);
  });

  test('Empty Password', async ({ page }) => {
    const loginRequests = countRequests(page, 'POST', LOGIN);
    await loginPage.fillEmail(ADMIN_EMAIL);
    await loginPage.clickSignIn();

    await expect(loginPage.fieldError('Password is required')).toBeVisible();
    await expect(loginPage.fieldError('Email is required')).toBeHidden();
    expect(loginRequests(), 'the form was submitted without a password').toBe(0);
  });

  test('Invalid Email Format', async ({ page }) => {
    const loginRequests = countRequests(page, 'POST', LOGIN);
    await loginPage.login('invalid-email', 'Whatever123');

    await expect(loginPage.fieldError('Enter a valid email address')).toBeVisible();
    await expect(loginPage.emailField).toHaveValue('invalid-email');
    expect(loginRequests(), 'the form was submitted with an invalid email').toBe(0);
  });

  test('Wrong Password', async () => {
    const response = await loginPage.loginAndWaitForResponse(ADMIN_EMAIL, 'WrongPassword123');

    expect(response.status()).toBe(401);
    await expect(loginPage.signInFailed).toBeVisible();
    await expect(loginPage.signInHeading).toBeVisible();
    await expect(loginPage.twoStepHeading).toBeHidden();
  });

  test('Non-existent User Email', async () => {
    const response = await loginPage.loginAndWaitForResponse('nonexistent.admin@example.com', 'WrongPassword123');

    expect(response.status()).toBe(401);
    await expect(loginPage.signInFailed).toBeVisible();
    await expect(loginPage.signInHeading).toBeVisible();
  });

  test('Wrong verification code is refused', async ({ page }) => {
    await loginPage.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    await expect(loginPage.codeField).toBeVisible({ timeout: 15_000 });

    const response = await loginPage.verifyCode('000000');

    expect(response.status()).toBe(401);
    await expect(loginPage.codeRejected).toBeVisible();
    await expect(loginPage.twoStepHeading).toBeVisible();

    // Still no session after the refused code
    await page.goto(new URL('/dashboard', ADMIN_URL).href);
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
  
  test('Dashboard cannot be opened without signing in', async ({ page }) => {
    await page.goto(new URL('/dashboard', ADMIN_URL).href);

    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    await expect(loginPage.signInHeading).toBeVisible();
  });
});
