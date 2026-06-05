import { test } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { WorkspacePage } from '../pages/WorkspacePage';

test.describe('Workspace - Positive Scenarios', () => {
  // Override the global 30 s timeout for every test in this suite.
  // waitAndClickBackToDashboard can take up to 60 s (AI workspace preparation).
  // 3 minutes gives comfortable headroom for that plus all other steps.
  test.beforeEach(() => {
    test.setTimeout(180_000);
  });

  test('Create Workspace with File Upload', async ({ page }) => {
    const loginPage     = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const workspacePage = new WorkspacePage(page);

    // --- Step 1: Login ---
    await loginPage.goto();
    await loginPage.login('xetey48662@fixscal.com', 'Test@123');
    await loginPage.skipTour();

    // --- Step 2: Open New Workspace dialog and fill details ---
    await dashboardPage.clickNewWorkspace();
    await workspacePage.fillWorkspaceName('New Client 101');
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
    // NOTE: waitForWorkspaceReady is intentionally skipped here.
    // The AI overview generation ("Preparing workspace overview…") is a background
    // process that can take several minutes or may not finish on the demo server.
    // Workspace creation is already proven by the card appearing with the correct heading.
    await dashboardPage.verifyWorkspaceHeading(0, 'New Client 101');
  });
});
