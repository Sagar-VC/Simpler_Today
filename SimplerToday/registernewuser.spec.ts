import { test, expect } from '@playwright/test';
import { LoginPage }       from '../pages/LoginPage';
import { RegisterPage }    from '../pages/RegisterPage';
import { UserProfilePage } from '../pages/UserProfilePage';

// ──────────────────────────────────────────────────────────────────────────────
// ✅  POSITIVE SCENARIOS
// ──────────────────────────────────────────────────────────────────────────────
test.describe('User Registration - Positive Scenarios', () => {
  test('Register new user and update profile', async ({ page }) => {
    const loginPage       = new LoginPage(page);
    const registerPage    = new RegisterPage(page);
    const userProfilePage = new UserProfilePage(page);

    const randomEmail = `xetey48662+${Date.now()}@fixscal.com`;

    // --- Step 1: Navigate to login page ---
    await loginPage.goto();

    // --- Step 2: Register a new user ---
    await registerPage.clickSignUpLink();
    await registerPage.fillFullName('sagar panchal qa');
    await registerPage.fillEmail(randomEmail);
    await registerPage.clickCreateAccount();
    await registerPage.skipTour();

    // --- Step 3: Open User Profile ---
    await userProfilePage.openProfile('s');

    // --- Step 4: Update profile details ---
    await userProfilePage.updateFullName('Anurag QA');
    await userProfilePage.updatePhone('2222112233');
    await userProfilePage.updateFirm('QA Tester');

    // --- Step 5: Save and verify ---
    await userProfilePage.saveProfile();
    await userProfilePage.verifySaved();
    await userProfilePage.backToDashboard();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// ❌  NEGATIVE SCENARIOS
// ──────────────────────────────────────────────────────────────────────────────
test.describe('User Registration - Negative Scenarios', () => {
  let loginPage: LoginPage;
  let registerPage: RegisterPage;

  // Navigate to the registration form before each test
  test.beforeEach(async ({ page }) => {
    loginPage    = new LoginPage(page);
    registerPage = new RegisterPage(page);
    await loginPage.goto();
    await registerPage.clickSignUpLink();
  });

  test('Empty Full Name', async ({ page }) => {
    // Submit with only the email filled — name left blank
    await registerPage.fillEmail('test@example.com');
    await registerPage.clickCreateAccount();

    // Form stays on the registration page — submit was blocked
    await expect(page.getByRole('button', { name: 'Create Professional Account' }))
      .toBeVisible();
  });

  test('Empty Email', async ({ page }) => {
    // Submit with only the name filled — email left blank
    await registerPage.fillFullName('Test User');
    await registerPage.clickCreateAccount();

    // Form stays on the registration page — submit was blocked
    await expect(page.getByRole('button', { name: 'Create Professional Account' }))
      .toBeVisible();
  });

  test('Both Fields Empty', async ({ page }) => {
    // Click submit without filling anything
    await registerPage.clickCreateAccount();

    // Form stays on the registration page — submit was blocked
    await expect(page.getByRole('button', { name: 'Create Professional Account' }))
      .toBeVisible();
  });

  test('Invalid Email Format', async ({ page }) => {
    // Submit with a name but a malformed email address
    await registerPage.fillFullName('Test User');
    await registerPage.fillEmail('invalid-email');
    await registerPage.clickCreateAccount();

    // Email field retains the invalid value — form was not submitted
    await expect(page.getByRole('textbox', { name: 'name@firm.com' }))
      .toHaveValue('invalid-email');
    await expect(page.getByRole('button', { name: 'Create Professional Account' }))
      .toBeVisible();
  });

  test('Already Registered Email', async ({ page }) => {
    const existingEmail = process.env.TEST_EMAIL ?? '';

    // Attempt to register with an email that already has an account
    await registerPage.fillFullName('Test User');
    await registerPage.fillEmail(existingEmail);
    await registerPage.clickCreateAccount();

    // App should surface an error — user stays on the registration page
    await expect(page.getByRole('button', { name: 'Create Professional Account' }))
      .toBeVisible();
    // TODO: replace with the app's actual error element once confirmed, e.g.:
    // await expect(page.getByRole('alert')).toContainText(/already|in use/i);
  });
});
