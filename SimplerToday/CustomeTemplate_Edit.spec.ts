import { test } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { TemplateLibraryPage } from '../pages/TemplateLibraryPage';

declare const process: { env: { TEST_EMAIL?: string; TEST_PASSWORD?: string } };
const EMAIL    = process.env.TEST_EMAIL    ?? '';
const PASSWORD = process.env.TEST_PASSWORD ?? '';

/** Create a blank custom template and return to the library listing. */
async function createCustomTemplate(tlp: TemplateLibraryPage) {
  await tlp.open();
  await tlp.verifyPageLoaded();
  await tlp.clickCreateCustom();
  await tlp.clickCreateCustomTemplate();
  await tlp.clickSaveChanges();
  await tlp.backToDashboard();
  await tlp.open();
}

test.describe('Custom Template - Edit Scenarios', () => {

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(EMAIL, PASSWORD);
    await loginPage.skipTour();
  });

  // ── Positive ────────────────────────────────────────────────────────────────

  test('Positive - Create custom template, rename and verify new name', async ({ page }) => {
    test.setTimeout(120_000);
    const tlp = new TemplateLibraryPage(page);

    await createCustomTemplate(tlp);

    const newName = `Custom Template ${Date.now()}`;
    await tlp.editFirstResult(newName);

    // Search for the new name and confirm it appears
    await tlp.search(newName);
    await tlp.verifyFileVisible(newName);

    // Clear search — template must still be visible in the full list
    await tlp.clearSearch();
    await tlp.verifyFileVisible(newName);
  });

  // ── Negative ────────────────────────────────────────────────────────────────

  test('Negative - Search for non-existent template shows no results', async ({ page }) => {
    test.setTimeout(60_000);
    const tlp = new TemplateLibraryPage(page);

    await tlp.open();
    await tlp.verifyPageLoaded();
    await tlp.search('NonExistentCustomTemplate_XYZ_99999');
    await tlp.verifyNoResults();
  });

  test('Negative - Old name not found after successful rename', async ({ page }) => {
    test.setTimeout(120_000);
    const tlp = new TemplateLibraryPage(page);

    // Create a template and give it a known original name
    await createCustomTemplate(tlp);
    const originalName = `Original-Template-${Date.now()}`;
    await tlp.editFirstResult(originalName);

    // Rename it to a new name
    await tlp.search(originalName);
    const newName = `Renamed-Template-${Date.now()}`;
    await tlp.editFirstResult(newName);

    // Searching for the OLD name should return no results
    await tlp.clearSearch();
    await tlp.search(originalName);
    await tlp.verifyFileNotVisible(originalName);

    // New name must be visible in the full list
    await tlp.clearSearch();
    await tlp.verifyFileVisible(newName);
  });

  test('Negative - Saving empty name does not overwrite original name', async ({ page }) => {
    test.setTimeout(120_000);
    const tlp = new TemplateLibraryPage(page);

    // Create a template and give it a known name first
    await createCustomTemplate(tlp);
    const knownName = `EmptyName-Test-Template-${Date.now()}`;
    await tlp.editFirstResult(knownName);

    // Clear the inline edit input and press Enter (attempt to save blank name)
    await tlp.search(knownName);
    await tlp.startInlineEdit();
    await tlp.inlineEditInput.clear();
    await tlp.inlineEditInput.press('Enter');

    // App should reject blank rename — original name must still be visible
    await tlp.verifyFileVisible(knownName);
  });

});
