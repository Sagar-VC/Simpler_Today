import { test }             from '@playwright/test';
import { LoginPage }        from '../pages/LoginPage';
import { RegisterPage }     from '../pages/RegisterPage';
import { UserProfilePage }  from '../pages/UserProfilePage';

test.describe('User Registration', () => {
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
