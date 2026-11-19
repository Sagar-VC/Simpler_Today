import { test, expect, Page } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { generateTotp, msUntilNextTotpWindow } from '../../utils/totp';

/**
 * A07:2021 - MFA sign-in for platform admins and enrolled users.
 *
 * QA verification for SIM-37 ("Lawyer app: add the MFA code step so platform
 * admins and MFA users can finish sign-in"), covering its acceptance criteria:
 *   - a platform admin with MFA can sign in by password
 *   - errors use friendly copy; no timers
 *   - users without MFA sign in exactly as before
 * and its test plan: a wrong code, a recovery code, an expired challenge.
 *
 * The SSO half of the ticket needs a real identity provider and stays manual —
 * see SimplerToday/security/OAuthFlow.spec.ts for what is automatable there.
 *
 * REQUIRES an MFA-enrolled account. Every test here skips itself when the
 * credentials are absent rather than failing, so the suite stays green on
 * environments where MFA is not yet enabled.
 */

const MFA_EMAIL    = process.env.TEST_EMAIL_MFA         ?? '';
const MFA_PASSWORD = process.env.TEST_PASSWORD_MFA      ?? '';
const MFA_SECRET   = process.env.TEST_TOTP_SECRET_MFA   ?? '';
const RECOVERY     = process.env.TEST_MFA_RECOVERY_CODE ?? '';

const EMAIL    = process.env.TEST_EMAIL    ?? '';
const PASSWORD = process.env.TEST_PASSWORD ?? '';

const mfaConfigured = Boolean(MFA_EMAIL && MFA_PASSWORD && MFA_SECRET);

/**
 * The MFA code step.
 *
 * NOTE FOR WHOEVER RUNS THIS FIRST: these locators were written against the
 * ticket's description (6-digit code entry, recovery-code option) and NOT
 * confirmed against a running build — at the time of writing the feature was
 * merged to `development` but not deployed anywhere reachable. The union below
 * covers the three shapes this UI normally takes; once it is deployed, delete
 * the branches that don't match rather than leaving the guesswork in place.
 */
function codeInput(page: Page) {
  return page
    .locator(
      [
        'input[autocomplete="one-time-code"]',
        'input[inputmode="numeric"]',
        'input[name*="code" i]',
      ].join(', ')
    )
    .first();
}

/** Any visible error banner. The app uses role="alert" for sign-in failures. */
function errorBanner(page: Page) {
  // A second, always-present empty aria-live region also carries role="alert",
  // so filter to one with actual text — a bare getByRole('alert') matches two
  // nodes and trips strict mode (same pattern as Login.spec.ts).
  return page.getByRole('alert').filter({ hasText: /\S/ });
}

/** Sign in with the password only, stopping at whatever comes next. */
async function submitPassword(page: Page, email: string, password: string) {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(email, password);
  return loginPage;
}

test.describe('Security - MFA sign-in (SIM-37)', () => {
  test('A correct password leads to the MFA code step, not a session', async ({ page }) => {
    test.skip(!mfaConfigured, 'TEST_EMAIL_MFA / TEST_PASSWORD_MFA / TEST_TOTP_SECRET_MFA not set');

    await submitPassword(page, MFA_EMAIL, MFA_PASSWORD);

    // The regression this ticket exists to prevent: before the fix, a correct
    // password left the user on a broken, logged-out page. Either outcome below
    // is wrong — reaching the dashboard would mean MFA was skipped entirely.
    await expect(
      codeInput(page),
      'no MFA code step appeared after a correct password — the user is stranded (the SIM-37 bug)'
    ).toBeVisible({ timeout: 20_000 });

    await expect(
      page.getByRole('button', { name: 'New Workspace' }),
      'signed straight in to the dashboard without being asked for a code — MFA was not enforced'
    ).toBeHidden();
  });

  test('A valid TOTP code completes sign-in', async ({ page }) => {
    test.skip(!mfaConfigured, 'TEST_EMAIL_MFA / TEST_PASSWORD_MFA / TEST_TOTP_SECRET_MFA not set');

    await submitPassword(page, MFA_EMAIL, MFA_PASSWORD);
    await expect(codeInput(page)).toBeVisible({ timeout: 20_000 });

    // Don't submit a code that is about to roll over: with under 3 seconds left
    // the backend may already be on the next window by the time it verifies,
    // which would fail the test for a reason that has nothing to do with the app.
    if (msUntilNextTotpWindow() < 3_000) {
      await page.waitForTimeout(msUntilNextTotpWindow() + 500);
    }

    await codeInput(page).fill(generateTotp(MFA_SECRET));
    await page.keyboard.press('Enter');

    await expect(
      page.getByRole('button', { name: 'New Workspace' }),
      'a valid MFA code did not complete sign-in'
    ).toBeVisible({ timeout: 20_000 });
  });

  test('A wrong code is refused with friendly copy and no countdown timer', async ({ page }) => {
    test.skip(!mfaConfigured, 'TEST_EMAIL_MFA / TEST_PASSWORD_MFA / TEST_TOTP_SECRET_MFA not set');

    await submitPassword(page, MFA_EMAIL, MFA_PASSWORD);
    await expect(codeInput(page)).toBeVisible({ timeout: 20_000 });

    // A deliberately wrong but well-formed code — the previous window's real
    // code is the cleanest "wrong" value: correct shape, genuinely rejected.
    await codeInput(page).fill(generateTotp(MFA_SECRET, { stepOffset: -2 }));
    await page.keyboard.press('Enter');

    const banner = errorBanner(page);
    await expect(banner, 'a wrong code produced no visible error').toBeVisible({ timeout: 15_000 });

    const message = (await banner.innerText()).trim();
    console.log('Wrong-code message:', message);

    // "Errors use friendly copy" — no stack traces, no error codes, no HTTP
    // status leaking into what the user reads.
    expect.soft(
      /MFA_CHALLENGE_INVALID|\b(401|403|500)\b|undefined|null|Error:/i.test(message),
      `wrong-code message exposes internal detail rather than friendly copy: "${message}"`
    ).toBe(false);

    // "no timers" — the acceptance criterion explicitly rules out a countdown.
    expect.soft(
      /\b\d+\s*(seconds?|secs?|minutes?|mins?)\b|\b\d{1,2}:\d{2}\b/i.test(message),
      `wrong-code message shows a countdown/timer, which SIM-37 rules out: "${message}"`
    ).toBe(false);

    // Still on the code step, not bounced back to the start.
    await expect(codeInput(page)).toBeVisible();
  });

  test('A recovery code completes sign-in', async ({ page }) => {
    test.skip(!mfaConfigured, 'TEST_EMAIL_MFA / TEST_PASSWORD_MFA / TEST_TOTP_SECRET_MFA not set');
    // Recovery codes are single-use: running this burns one of the ten. It is
    // opt-in for that reason — set TEST_MFA_RECOVERY_CODE to a fresh unused code
    // and expect to replace it before the next run.
    test.skip(!RECOVERY, 'TEST_MFA_RECOVERY_CODE not set (single-use — opt in deliberately)');

    await submitPassword(page, MFA_EMAIL, MFA_PASSWORD);
    await expect(codeInput(page)).toBeVisible({ timeout: 20_000 });

    await codeInput(page).fill(RECOVERY);
    await page.keyboard.press('Enter');

    await expect(
      page.getByRole('button', { name: 'New Workspace' }),
      'a recovery code did not complete sign-in'
    ).toBeVisible({ timeout: 20_000 });

    console.log('Recovery code consumed — replace TEST_MFA_RECOVERY_CODE before the next run.');
  });

  test('An expired sign-in challenge is refused with "timed out" copy', async ({ page }) => {
    test.skip(!mfaConfigured, 'TEST_EMAIL_MFA / TEST_PASSWORD_MFA / TEST_TOTP_SECRET_MFA not set');
    // The challenge ticket lives for 5 minutes, so this test cannot take less
    // than that. Opt-in so a normal suite run isn't held up by one test.
    test.skip(
      process.env.RUN_SLOW_MFA_EXPIRY !== '1',
      'set RUN_SLOW_MFA_EXPIRY=1 to run the 5-minute challenge-expiry check'
    );
    test.setTimeout(480_000);

    await submitPassword(page, MFA_EMAIL, MFA_PASSWORD);
    await expect(codeInput(page)).toBeVisible({ timeout: 20_000 });

    // 5 minutes plus a margin for clock skew between this machine and the server.
    await page.waitForTimeout(5 * 60_000 + 20_000);

    await codeInput(page).fill(generateTotp(MFA_SECRET));
    await page.keyboard.press('Enter');

    const banner = errorBanner(page);
    await expect(banner, 'an expired challenge produced no visible error').toBeVisible({ timeout: 20_000 });

    const message = (await banner.innerText()).trim();
    console.log('Expired-challenge message:', message);

    expect.soft(
      /timed out|expired|start again|try again/i.test(message),
      `expired challenge should say the sign-in timed out; got: "${message}"`
    ).toBe(true);
    expect.soft(
      /MFA_CHALLENGE_INVALID/.test(message),
      `the raw error code MFA_CHALLENGE_INVALID is leaking into user-facing copy: "${message}"`
    ).toBe(false);
  });

  test('A user without MFA signs in exactly as before', async ({ page }) => {
    // No skip: this is the regression guard for the fourth acceptance criterion
    // and runs on every environment with the ordinary test account.
    await submitPassword(page, EMAIL, PASSWORD);

    await expect(
      page.getByRole('button', { name: 'New Workspace' }),
      'a non-MFA account no longer signs straight in — the MFA step is being shown to users who never enrolled'
    ).toBeVisible({ timeout: 20_000 });

    await expect(codeInput(page)).toBeHidden();
  });
});
