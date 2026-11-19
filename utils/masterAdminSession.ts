import { Browser, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { MasterAdminLoginPage } from '../pages/MasterAdminLoginPage';
import { RecoveryCodes } from './recoveryCodes';
import { generateTotp, msUntilNextTotpWindow } from './totp';

/**
 * A signed-in Master Admin session for the admin console, saved in .auth/
 * (git-ignored: it holds a refresh token) and reused across runs.
 *
 * Without an authenticator secret every sign-in spends a single-use recovery
 * code, so the saved session is reused while it still opens the dashboard and
 * a new sign-in only happens once it has expired.
 *
 * The console rotates its refresh token, so tests must write the context's
 * state back to MASTER_ADMIN_SESSION when they finish — the file has to hold
 * the latest token or the next run starts signed out.
 */
export const MASTER_ADMIN_SESSION = path.join(__dirname, '..', '.auth', 'master-admin-session.json');

/**
 * Make sure MASTER_ADMIN_SESSION holds a working session.
 * Returns null when it does, or the reason it can't (for test.skip).
 */
export async function ensureMasterAdminSession(browser: Browser): Promise<string | null> {
  const adminUrl = process.env.ADMIN_URL                  ?? '';
  const email    = process.env.TEST_EMAIL_MASTER_ADMIN    ?? '';
  const password = process.env.TEST_PASSWORD_MASTER_ADMIN ?? '';
  if (!adminUrl || !email || !password) {
    return 'ADMIN_URL / TEST_EMAIL_MASTER_ADMIN / TEST_PASSWORD_MASTER_ADMIN not set in .env';
  }

  // --- Reuse the saved session if it still opens the dashboard ---
  if (fs.existsSync(MASTER_ADMIN_SESSION)) {
    const context = await browser.newContext({ storageState: MASTER_ADMIN_SESSION });
    const page    = await context.newPage();
    await page.goto(new URL('/dashboard', adminUrl).href);
    const valid = await page
      .getByRole('heading', { name: 'Dashboard' })
      .waitFor({ timeout: 15_000 })
      .then(() => true, () => false);
    if (valid) await context.storageState({ path: MASTER_ADMIN_SESSION });
    await context.close();
    if (valid) return null;
  }

  // --- Sign in again: authenticator code if available, otherwise a recovery code ---
  const totpSecret = process.env.TEST_TOTP_SECRET_MASTER_ADMIN ?? '';
  const codes      = new RecoveryCodes(process.env.TEST_MFA_RECOVERY_CODES_MASTER_ADMIN ?? '', 'master-admin-recovery-codes');
  if (!totpSecret && !codes.available()) {
    return codes.paused()
      ? 'Recovery codes paused: one was refused. Put unused codes in TEST_MFA_RECOVERY_CODES_MASTER_ADMIN, or set TEST_TOTP_SECRET_MASTER_ADMIN'
      : `No way to pass two-step verification: set TEST_TOTP_SECRET_MASTER_ADMIN, or add fresh codes to ` +
          `TEST_MFA_RECOVERY_CODES_MASTER_ADMIN (${codes.remaining()} unused left, ${codes.reserve} kept in reserve)`;
  }

  const context   = await browser.newContext();
  const page      = await context.newPage();
  const loginPage = new MasterAdminLoginPage(page, adminUrl);
  // Never let a sign-in start MFA setup, which would create and show a new secret
  await page.route(/\/mfa\/enrol/, route => route.abort());

  await loginPage.goto();
  await loginPage.login(email, password);
  await expect(loginPage.codeField).toBeVisible({ timeout: 15_000 });

  // Don't submit an authenticator code in the last seconds of its window
  if (totpSecret && msUntilNextTotpWindow() < 3_000) await page.waitForTimeout(msUntilNextTotpWindow() + 500);
  const response = await loginPage.verifyCode(totpSecret ? generateTotp(totpSecret) : codes.take());
  if (!totpSecret && response.status() !== 200) {
    // A refused recovery code is a test-setup problem (used by hand, or a new set
    // was generated), not an app failure: pause codes and skip with the reason.
    codes.markRefused();
    await context.close();
    return 'A recovery code was refused (used by someone already, or the codes were regenerated). ' +
      'Recovery codes are paused: put fresh codes in TEST_MFA_RECOVERY_CODES_MASTER_ADMIN, or set TEST_TOTP_SECRET_MASTER_ADMIN';
  }
  expect(response.status(), 'the authenticator code was refused').toBe(200);
  await expect(loginPage.dashboardHeading).toBeVisible({ timeout: 20_000 });

  if (!totpSecret) console.log(`Signed in with a recovery code: ${codes.remaining()} unused left (${codes.reserve} kept in reserve)`);
  await context.storageState({ path: MASTER_ADMIN_SESSION });
  await context.close();
  return null;
}
