import { test, expect } from '@playwright/test';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage';

// ── Credentials from environment variables (.env file)
// Never commit real values — see .env.example for the required keys.
const VALID_EMAIL = (globalThis as any).process?.env?.TEST_EMAIL ?? '';

// ──────────────────────────────────────────────────────────────
// ✅  POSITIVE SCENARIOS
// ──────────────────────────────────────────────────────────────
test.describe('Forgot Password - Positive Scenarios', () => {
  let forgotPage: ForgotPasswordPage;

  test.beforeEach(async ({ page }) => {
    forgotPage = new ForgotPasswordPage(page);
    await forgotPage.goto(); // navigates to login → clicks "Forgot password?"
  });

  test('Valid Email - Reset Link Sent', async () => {
    await forgotPage.requestPasswordReset(VALID_EMAIL);

    // App confirms reset link was dispatched
    await expect(forgotPage.successMessage).toBeVisible();
  });

  test('Back to Sign In Link', async () => {
    await forgotPage.backToSignInLink.click();

    // Verify navigation back to the login page
    await expect(forgotPage.loginButton).toBeVisible();
  });
});

// ──────────────────────────────────────────────────────────────
// ❌  NEGATIVE SCENARIOS
// ──────────────────────────────────────────────────────────────
test.describe('Forgot Password - Negative Scenarios', () => {
  let forgotPage: ForgotPasswordPage;

  test.beforeEach(async ({ page }) => {
    forgotPage = new ForgotPasswordPage(page);
    await forgotPage.goto(); // navigates to login → clicks "Forgot password?"
  });

  test('Empty Email', async () => {
    // Submit without filling the email field
    await forgotPage.submit();

    // HTML5 required-field validation blocks submission — form stays visible
    await expect(forgotPage.emailField).toBeVisible();
    await expect(forgotPage.sendResetLinkButton).toBeVisible();
  });

  test('Invalid Email Format', async () => {
    await forgotPage.requestPasswordReset('invalid-email-format');

    // HTML5 type="email" validation blocks submission — stays on forgot password page
    await expect(forgotPage.heading).toBeVisible();
    await expect(forgotPage.sendResetLinkButton).toBeVisible();
  });

  test('Non-existent User Email', async () => {
    await forgotPage.requestPasswordReset('nonexistent@example.com');

    // App does not recognise the email — user stays on the forgot password page
    await expect(forgotPage.heading).toBeVisible();
    await expect(forgotPage.sendResetLinkButton).toBeVisible();
  });

  test('Special Characters in Email', async () => {
    await forgotPage.requestPasswordReset('test<script>@example.com');

    // App / HTML5 validation rejects the malformed email — stays on forgot password page
    await expect(forgotPage.heading).toBeVisible();
    await expect(forgotPage.sendResetLinkButton).toBeVisible();
  });
});
