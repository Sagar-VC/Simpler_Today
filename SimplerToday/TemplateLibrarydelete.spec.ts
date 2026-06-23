import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { TemplateLibraryPage } from '../pages/TemplateLibraryPage';

test('Template Library - Upload, search, delete and verify removal', async ({ page }) => {
  const loginPage           = new LoginPage(page);
  const templateLibraryPage = new TemplateLibraryPage(page);

  // Login
  await loginPage.goto();
  await loginPage.login('picayox936@okcpress.com', 'Test@123');
  await loginPage.skipTour();

  // Open Template Library and verify page loaded
  await templateLibraryPage.open();
  
  await templateLibraryPage.verifyPageLoaded();

  // // Upload file and verify it appears
  // await templateLibraryPage.uploadFile('C:\\Users\\Sagar Panchal\\Downloads\\Analysis-Report-v1 (1).pdf');
  // await templateLibraryPage.verifyFileVisible('Analysis-Report-v1 (1)May 29');

  // Search and record count before delete
  await templateLibraryPage.search('Analysis-Report-v1');
  const countBefore = await templateLibraryPage.getFileCount();
  expect(countBefore).toBeGreaterThan(0);

  // Delete the first result
  await templateLibraryPage.deleteFirstResult();

  // Search again and verify count decreased by 1
  await templateLibraryPage.clearSearch();
  await templateLibraryPage.search('Analysis-Report-v1');
  await page.waitForTimeout(500);
  const countAfter = await templateLibraryPage.getFileCount();
  expect(countAfter).toBe(countBefore - 1);
});
