import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

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

  test('Valid Credentials', async ({ page }) => {
    await loginPage.login(VALID_EMAIL, VALID_PASSWORD);

    // Confirm successful login — dashboard loads with the "New Workspace" button.
    // Skip Tour is a one-time onboarding overlay; it is not shown on every login
    // and is therefore not a reliable post-login indicator.
    await expect(page.getByRole('button', { name: 'New Workspace' }))
      .toBeVisible({ timeout: 15_000 });
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

  test('Invalid Email Format', async ({ page }) => {
    await loginPage.login('invalid-email', VALID_PASSWORD);

    const emailField = page.getByRole('textbox', { name: 'name@firm.com' });

    // Email validation blocks submission — the field stays visible
    // and still holds the rejected value (form was never submitted/reset)
    await expect(emailField).toBeVisible();
    await expect(emailField).toHaveValue('invalid-email');
  });

  test('Wrong Password', async ({ page }) => {
    await loginPage.login(VALID_EMAIL, 'WrongPassword123');

    // User remains on the login page
    await expect(page.getByRole('button', { name: /login to workspace/i })).toBeVisible();
    // TODO: replace with the app's actual error element, e.g.:
    // await expect(page.getByRole('alert')).toContainText('Invalid credentials');
  });
  test('Empty Email', async ({ page }) => {
    // Submit with only the password filled — email left blank
    await loginPage.fillPassword(VALID_PASSWORD);
    await loginPage.clickLogin();

    const emailField = page.getByRole('textbox', { name: 'name@firm.com' });

    // Email field should still be present and required
    await expect(emailField).toBeVisible();
    await expect(page.getByRole('button', { name: /login to workspace/i })).toBeVisible();
  });

  test('Empty Password', async ({ page }) => {
    // Submit with only the email filled — password left blank
    await loginPage.fillEmail(VALID_EMAIL);
    await loginPage.clickLogin();

    const emailField = page.getByRole('textbox', { name: 'name@firm.com' });

    // User remains on the login page
    await expect(emailField).toBeVisible();
    await expect(page.getByRole('button', { name: /login to workspace/i })).toBeVisible();
  });

  test('Non-existent User Email', async ({ page }) => {
    await loginPage.login('nonexistent@example.com', VALID_PASSWORD);

    // User remains on the login page
    await expect(page.getByRole('button', { name: /login to workspace/i })).toBeVisible();
    // TODO: replace with the app's actual error element, e.g.:
    // await expect(page.getByRole('alert')).toContainText('Invalid credentials');
  });
});
