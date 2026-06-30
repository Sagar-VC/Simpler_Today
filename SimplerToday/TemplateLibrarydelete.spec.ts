// import { test, expect } from '@playwright/test';
// import { LoginPage } from '../pages/LoginPage';
// import { TemplateLibraryPage } from '../pages/TemplateLibraryPage';

// declare const process: { 
// env: {
//    TEST_EMAIL?: 
//   string; TEST_PASSWORD?: string
//  } };
// const EMAIL    = process.env.TEST_EMAIL    ?? '';
// const PASSWORD = process.env.TEST_PASSWORD ?? '';

// test('Template Library - Upload, search, delete and verify removal', async ({ page }) => {
//   const loginPage           = new LoginPage(page);
//   const DocumentDrafts = new TemplateLibraryPage(page);

//   // Login
//   await loginPage.goto();
//   await loginPage.login(EMAIL, PASSWORD);
//   await loginPage.skipTour();

//   // Open Template Library and verify page loaded
//   await DocumentDrafts.open();
  
//   await DocumentDrafts.verifyPageLoaded();

//   // // Upload file and verify it appears
//    await DocumentDrafts.uploadFile('C:\\Users\\Sagar Panchal\\Downloads\\Test Case 6_ Defective Luxury Watch\Test Case 6_ Defective Luxury Watch\\Conversation.pdf');

//   // Search and record count before delete
//   await DocumentDrafts.search('Analysis-Report-v1');
//   const countBefore = await DocumentDrafts.getFileCount();
//   expect(countBefore).toBeGreaterThan(0);

//   // Delete the first result
//   await DocumentDrafts.deleteFirstResult();

//   // Search again and verify count decreased by 1
//   await DocumentDrafts.clearSearch();
//   await DocumentDrafts.search('Analysis-Report-v1');
//   await page.waitForTimeout(500);
//   const countAfter = await DocumentDrafts.getFileCount();
//   expect(countAfter).toBe(countBefore - 1);
// });
