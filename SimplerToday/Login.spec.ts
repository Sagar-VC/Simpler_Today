import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

declare const process: { env: { TEST_EMAIL?: string; TEST_PASSWORD?: string } };

// ── Credentials from environment variables (.env file)
// Never commit real values — see .env.example for the required keys.
const VALID_EMAIL    = process.env.TEST_EMAIL    ?? '';
const VALID_PASSWORD = process.env.TEST_PASSWORD ?? '';

// ──────────────────────────────────────────────────────────────
// ✅  POSITIVE SCENARIOS
// ──────────────────────────────────────────────────────────────
test.describe('Login - Positive Scenarios', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test('Valid Credentials', async () => {
    await loginPage.login(VALID_EMAIL, VALID_PASSWORD);

    // Confirm successful login — Skip Tour button appears only after login
    await expect(loginPage.skipTourButton).toBeVisible();
  });
});

// ──────────────────────────────────────────────────────────────
// ❌  NEGATIVE SCENARIOS
// ──────────────────────────────────────────────────────────────
test.describe('Login - Negative Scenarios', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test('Invalid Email Format', async () => {
    await loginPage.login('invalid-email', VALID_PASSWORD);

    // Email validation blocks submission — the field stays visible
    // and still holds the rejected value (form was never submitted/reset)
    await expect(loginPage.emailField).toBeVisible();
    await expect(loginPage.emailField).toHaveValue('invalid-email');
  });

  test('Wrong Password', async () => {
    await loginPage.login(VALID_EMAIL, 'WrongPassword123');

    // User remains on the login page
    await expect(loginPage.loginButton).toBeVisible();
    // TODO: replace with the app's actual error element, e.g.:
    // await expect(page.getByRole('alert')).toContainText('Invalid credentials');
  });

  test('Empty Email', async () => {
    // Submit with only the password filled — email left blank
    await loginPage.fillPassword(VALID_PASSWORD);
    await loginPage.clickLogin();

    // Email field should still be present and required
    await expect(loginPage.emailField).toBeVisible();
    await expect(loginPage.loginButton).toBeVisible();
  });

  test('Empty Password', async () => {
    // Submit with only the email filled — password left blank
    await loginPage.fillEmail(VALID_EMAIL);
    await loginPage.clickLogin();

    // User remains on the login page
    await expect(loginPage.emailField).toBeVisible();
    await expect(loginPage.loginButton).toBeVisible();
  });

  test('Non-existent User Email', async () => {
    await loginPage.login('nonexistent@example.com', VALID_PASSWORD);

    // User remains on the login page
    await expect(loginPage.loginButton).toBeVisible();
    // TODO: replace with the app's actual error element, e.g.:
    // await expect(page.getByRole('alert')).toContainText('Invalid credentials');
  });
});
