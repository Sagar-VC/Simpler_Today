import { test } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { TemplateLibraryPage } from '../pages/TemplateLibraryPage';

test('Template Library - Upload and verify file', async ({ page }) => {
  test.setTimeout(90_000);
  const loginPage           = new LoginPage(page);
  const templateLibraryPage = new TemplateLibraryPage(page);

  // Login
  await loginPage.goto();
  await loginPage.login('picayox936@okcpress.com', 'Test@123');
  await loginPage.skipTour();

  // Open Template Library, verify page, go back to dashboard
  await templateLibraryPage.open();
  await templateLibraryPage.verifyPageLoaded();
  await templateLibraryPage.backToDashboard();


  // Open Template Library again, upload file and verify it appears
  await templateLibraryPage.open();
  await templateLibraryPage.clickCreatedCustomerTemplate();
  await templateLibraryPage.clickCustomTemplate1(); 
  await templateLibraryPage.ClickSaveChanges();
  


  // pending scenario .....................

  //await templateLibraryPage.uploadFile('C:\\Users\\Sagar Panchal\\Downloads\\Analysis-Report-v1 (1).pdf');
  await templateLibraryPage.verifyFileVisible('Analysis-Report-v1 (1)');
});
