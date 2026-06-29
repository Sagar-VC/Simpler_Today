import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { TemplateLibraryPage } from '../pages/TemplateLibraryPage';

declare const process: { env: { TEST_EMAIL?: string; TEST_PASSWORD?: string } };
const EMAIL    = process.env.TEST_EMAIL    ?? '';
const PASSWORD = process.env.TEST_PASSWORD ?? '';

const FILE_PATH = 'C:\\Users\\Sagar Panchal\\Downloads\\Analysis-Report-v1 (1).pdf';

test.describe('Template Library - Edit', () => {

  test.beforeEach(async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(EMAIL, PASSWORD);
    await loginPage.skipTour();
  });

  // ── Positive ────────────────────────────────────────────────────────────────

  test('Positive - , supdatyearch, rename and verify new name appears', async ({ page }) => {
    const tlp = new TemplateLibraryPage(page);

    await tlp.open();
    await tlp.verifyPageLoaded();
    await tlp.uploadFile(FILE_PATH);
    await tlp.verifyFileVisible('Analysis-Report-v1 (1)May 29');

    await tlp.search('Analysis-Report-v1');
    await tlp.verifyFileVisible('Analysis-Report-v1 (1)May 29');

    const newFileName = `Updated-Analysis-Report-${Date.now()}`;
    await tlp.editFirstResult(newFileName);
    await tlp.clearSearch();
    await tlp.search(newFileName);
    await tlp.verifyFileVisible(newFileName);
  });

  // ── Negative ────────────────────────────────────────────────────────────────

  test('Negative - Search for non-existent file shows no results', async ({ page }) => {
    const tlp = new TemplateLibraryPage(page);

    await tlp.open();
    await tlp.verifyPageLoaded();
    await tlp.search('NonExistentFile_XYZ_99999');
    await tlp.verifyNoResults();
  });

  test('Negative - Cancel rename with Escape preserves original name', async ({ page }) => {
    const tlp = new TemplateLibraryPage(page);

    await tlp.open();
    await tlp.verifyPageLoaded();
    await tlp.uploadFile(FILE_PATH);

    await tlp.search('Analysis-Report-v1');
    await tlp.verifyFileVisible('Analysis-Report-v1 (1)May 29');

    // Start edit, type a new name, then cancel with Escape
    await tlp.startInlineEdit();
    await tlp.inlineEditInput.fill('Cancelled-Name-Should-Not-Save');
    await tlp.inlineEditInput.press('Escape');

    // Original name must still be visible
    await tlp.verifyFileVisible('Analysis-Report-v1 (1)May 29');
    await tlp.verifyFileNotVisible('Cancelled-Name-Should-Not-Save');
  });

  test('Negative - Saving empty name does not overwrite original name', async ({ page }) => {
    const tlp = new TemplateLibraryPage(page);

    await tlp.open();
    await tlp.verifyPageLoaded();
    await tlp.uploadFile(FILE_PATH);

    await tlp.search('Analysis-Report-v1');
    await tlp.verifyFileVisible('Analysis-Report-v1 (1)May 29');

    // Clear the inline edit input and press Enter (attempt to save empty name)
    await tlp.startInlineEdit();
    await tlp.inlineEditInput.clear();
    await tlp.inlineEditInput.press('Enter');

    // Original name must still be visible (app should reject blank rename)
    await tlp.verifyFileVisible('Analysis-Report-v1 (1)May 29');
  });

  test('Negative - Old name not found after successful rename', async ({ page }) => {
    const tlp = new TemplateLibraryPage(page);

    await tlp.open();
    await tlp.verifyPageLoaded();
    await tlp.uploadFile(FILE_PATH);

    // Record how many cards match the original name before renaming
    await tlp.search('Analysis-Report-v1');
    const countBefore = await tlp.getFileCount();
    expect(countBefore).toBeGreaterThan(0);

    // Rename the first card
    const newFileName = `Renamed-Report-${Date.now()}`;
    await tlp.editFirstResult(newFileName);

    // Search by old name — count must have decreased by 1
    await tlp.clearSearch();
    await tlp.search('Analysis-Report-v1');
    const countAfter = await tlp.getFileCount();
    expect(countAfter).toBe(countBefore - 1);
  });

});



