import { test } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { CustomTemplatePage } from '../pages/CustomTemplatePage';

declare const process: { env: { TEST_EMAIL?: string; TEST_PASSWORD?: string } };
const EMAIL    = process.env.TEST_EMAIL    ?? '';
const PASSWORD = process.env.TEST_PASSWORD ?? '';

test.describe('Custom Template - Delete Scenario', () => {

  test('Create a custom template, delete it and verify it no longer appears', async ({ page }) => {
    test.setTimeout(120_000);

    const loginPage = new LoginPage(page);
    const tlp       = new CustomTemplatePage(page);

    // --- Step 1: Login ---
    await loginPage.goto();
    await loginPage.login(EMAIL, PASSWORD);
    await loginPage.skipTour();

    // --- Step 2: Open Template Library and create a custom template ---
    await tlp.open();
    await tlp.verifyPageLoaded();
    await tlp.clickCreateCustom();
    await tlp.clickCreateCustomTemplate();
    await tlp.clickSaveChanges();

    // --- Step 3: Return to library and give the template a unique name ---
    await tlp.backToDashboard();
    await tlp.open();
    const templateName = `Delete-Test-Template-${Date.now()}`;
    await tlp.editFirstResult(templateName);

    // --- Step 4: Confirm the template is visible before deletion ---
    await tlp.search(templateName);
    await tlp.verifyFileVisible(templateName);

    // --- Step 5: Delete the template ---
    await tlp.deleteFirstResult();

    // --- Step 6: Search again and verify the template is gone ---
    await tlp.clearSearch();
    await tlp.search(templateName);
    await tlp.verifyFileNotVisible(templateName);
  });

});
