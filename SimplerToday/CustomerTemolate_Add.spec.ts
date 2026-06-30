import { test } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { CustomTemplatePage } from '../pages/CustomTemplatePage';

declare const process: { env: { TEST_EMAIL?: string; TEST_PASSWORD?: string } };
const EMAIL    = process.env.TEST_EMAIL    ?? '';
const PASSWORD = process.env.TEST_PASSWORD ?? '';

const CustomTemplateName = 'Custom Template 1 ' + Date.now();

test.describe('Template Creation', () => {

  test('Open Template Library and create custom template', async ({ page }) => {
    test.setTimeout(120_000);
    const loginPage           = new LoginPage(page);
    const templateLibraryPage = new CustomTemplatePage(page);

    // Login
    await loginPage.goto();
    await loginPage.login(EMAIL, PASSWORD);
    await loginPage.skipTour();

    // Open Template Library, verify page loads, then go back
    await templateLibraryPage.open();
    await templateLibraryPage.verifyPageLoaded();
    await templateLibraryPage.backToDashboard();

    // Open Template Library again and create a custom template
    await templateLibraryPage.open();
    await templateLibraryPage.clickCreateCustom();
    await templateLibraryPage.clickCreateCustomTemplate();
    await templateLibraryPage.clickSaveChanges();

    // Navigate back to the library so we can rename the new template
    await templateLibraryPage.backToDashboard();
    await templateLibraryPage.open();

    // Rename the first (newest) card to CustomTemplateName
    await templateLibraryPage.editFirstResult(CustomTemplateName);

    // Search for the template and verify it appears in results
    await templateLibraryPage.search(CustomTemplateName);
    await templateLibraryPage.verifyFileVisible(CustomTemplateName);

    // Clear search and verify it is still visible in the full list
    await templateLibraryPage.clearSearch();
    await templateLibraryPage.verifyFileVisible(CustomTemplateName);
  });
});
