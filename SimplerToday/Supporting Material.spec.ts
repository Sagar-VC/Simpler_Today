import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { WorkspacePage } from '../pages/WorkspacePage';

// Trace/video disabled — large recordings cause ENOENT on teardown.
test.use({ trace: 'off', video: 'off' });

test.describe('Workspace - Positive Scenarios', () => {
  test.beforeEach(() => {
    test.setTimeout(1_500_000); // 25 minutes — file processing can take ~15 min
  });

  test('reate Workspace with File Upload and Supporting Material', async ({ page }) => {
    const loginPage     = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const workspacePage = new WorkspacePage(page);

    const workspaceName = `New Client ${Date.now()}`;

    // --- Step 1: Login ---
    await loginPage.goto();
    await loginPage.login('picayox936@okcpress.com', 'Test@123');
    await loginPage.skipTour();

    // --- Step 2: Open New Workspace dialog and fill details ---
    await dashboardPage.clickNewWorkspace();
    await workspacePage.fillWorkspaceName(workspaceName);
    await workspacePage.selectRole('petitioner');

    // --- Step 3: Upload file ---
    await workspacePage.expandUploadSection();
    await workspacePage.uploadFile('C:/Users/Sagar Panchal/Downloads/Analysis-Report-v1 (1).pdf');
    await workspacePage.waitForFileUploaded('Analysis-Report-v1 (1).pdf');

    // --- Step 4: Submit and wait for workspace to be created ---
    await workspacePage.clickCreateWorkspace();
    await workspacePage.waitForPreparationScreen();
    await workspacePage.waitAndClickBackToDashboard();

    // --- Step 5: Confirm navigation landed on the dashboard URL ---
    await dashboardPage.verifyDashboardURL();

    // --- Step 6: Verify new workspace card on dashboard ---
    await dashboardPage.waitForWorkspaceCard(0);
    await dashboardPage.verifyWorkspaceHeading(0, workspaceName);

    // --- Step 7: Open the workspace ---
    await dashboardPage.openWorkspace(0, workspaceName);

    // --- Step 8: Skip the workspace welcome tour ---
    await page.getByText('Skip Tour').click();

    // --- Step 9: Navigate to Supporting Material section in sidebar ---
    await page.getByText('Supporting Material').click();

    // --- Step 10: Poll until the file appears, then click it immediately ---
    // File is processed asynchronously — check every 30 s; mouse move keeps browser alive.
    const fileLocator = page.getByText('Analysis-Report-v1 (1).pdf').first();
    let fileReady = false;
    const maxAttempts = 40; // 40 × 30 s = 20 minutes max
    for (let i = 0; i < maxAttempts; i++) {
      await page.mouse.move(400, 300);
      if (await fileLocator.isVisible().catch(() => false)) {
        fileReady = true;
        break;
      }
      if (i < maxAttempts - 1) await page.waitForTimeout(30_000);
    }
    if (!fileReady) throw new Error('File "Analysis-Report-v1 (1).pdf" was not ready after 20 minutes');
        console.log('File is ready, clicking on it now');
    await fileLocator.click();


    // --- Step 11: Verify the file details page has opened ---
    await expect(page.getByText('Supporting Material').first()).toBeVisible({ timeout: 30_000 });
    console.log('File details page opened successfully');
    await page.getByText('Analysis-Report-v1 (1).pdf').first().hover({ timeout: 30_000 });
    console.log('Clicked on file options menu');
    await page.locator('div[class*="group-hover:opacity-100"] button').first().click({ timeout: 30_000 });
    await expect(page.getByText('Document Insights').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Analysis-Report-v1 (1).pdf').first()).toBeVisible({ timeout: 30_000 });
    
    // --- Verify Summary section ---
    // Use an XPath locator to match the label with normalize-space()
    await expect(page.locator("//label[normalize-space()='Summary']").first()).toBeVisible({ timeout: 30_000 });
    console.log('Summary label is visible');
    await page.locator('p[class*="whitespace-pre-wrap"]').first().scrollIntoViewIfNeeded();
    await expect(page.locator('p[class*="whitespace-pre-wrap"]').first()).toBeVisible({ timeout: 30_000 });
    console.log('Summary content is visible');
  
    await page.getByRole('button', { name: 'Close' }).click();
    await page.locator("//button[@title='Open Document']").click({ timeout: 30_000 });
    await expect(page.getByText('Analysis-Report-v1 (1).pdf').first()).toBeVisible({ timeout: 30_000 })
    await page.locator("//button[@class='text-xs font-bold px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 bg-white transition-colors']").click({ timeout: 30_000 });
    await page.locator("//button[@title='Close']//*[name()='svg']").click({ timeout: 30_000 });
    await page.locator("//input[@placeholder='Search documents...']").click({ timeout: 30_000 });
    await page.locator("//input[@placeholder='Search documents...']").fill('Analysis-Report-v1');
    await page.waitForTimeout(500);
    await expect(page.getByText('Analysis-Report-v1 (1).pdf').first()).toBeVisible({ timeout: 30_000 });
    console.log('File search is working correctly');
    
    // --- Step 12: Hover over file and click delete button ---
    await page.getByText('Analysis-Report-v1 (1).pdf').first().hover({ timeout: 30_000 });
    await page.locator('button[class*="hover:text-red-600"]').click({ timeout: 30_000 });
    console.log('Clicked on delete button');

    // --- Step 13: Verify "Delete Document?" popup is visible ---
    await expect(page.getByText('Delete Document?')).toBeVisible({ timeout: 10_000 });
    console.log('Delete Document popup is visible');

    // --- Step 14: Click "Confirm Delete" button ---
    await page.getByRole('button', { name: 'Confirm Delete' }).click({ timeout: 10_000 });
    console.log('Clicked Confirm Delete button');

    // --- Step 15: Verify deleted file no longer appears in search results ---
    await page.waitForTimeout(2_000);
    await expect(page.getByText('Analysis-Report-v1 (1).pdf').first()).not.toBeVisible({ timeout: 15_000 });
    console.log('Verified: deleted file "Analysis-Report-v1 (1).pdf" no longer appears in search results');
  });
}); 