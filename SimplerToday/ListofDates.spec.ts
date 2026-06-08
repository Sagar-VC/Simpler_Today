import { test } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { WorkspacePage } from '../pages/WorkspacePage';
import { SupportingMaterialPage } from '../pages/SupportingMaterialPage';
import { ListofDatesPage } from '../pages/ListofDatesPage';

// Trace/video disabled — large recordings cause ENOENT on teardown.
test.use({ trace: 'off', video: 'off' });

test.describe('Workspace - List of Dates - Positive Scenarios', () => {
  test.beforeEach(() => {
    test.setTimeout(1_500_000); // 25 minutes — file processing can take ~15 min
  });

  test('Create List of Dates', async ({ page }) => {
    const loginPage            = new LoginPage(page);
    const dashboardPage        = new DashboardPage(page);
    const workspacePage        = new WorkspacePage(page);
    const supportingMaterialPage = new SupportingMaterialPage(page);
    const listofDatesPage      = new ListofDatesPage(page);

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

    // --- Step 9: Navigate to Supporting Material and wait for file ---
    await supportingMaterialPage.navigateToSection();
    await supportingMaterialPage.waitForFileReady('Analysis-Report-v1 (1).pdf');
    console.log('File is ready');

    // --- Step 10: Navigate to List of Dates section ---
    await listofDatesPage.navigateToSection();

    // --- Step 11: Add a new event ---
    await listofDatesPage.clickAddEvent();
    await listofDatesPage.fillDate('2026-06-08');
    await listofDatesPage.fillEventTitle('Test data 1');
    await listofDatesPage.fillDescription('this are the testing data');
    await listofDatesPage.selectSourceDocument('Analysis-Report-v1 (1).pdf');
    await listofDatesPage.fillPageNumber('1');
    await listofDatesPage.saveEvent();
    console.log('Event saved successfully');

    // --- Step 12: Verify the event appears in the list ---
    await listofDatesPage.verifyEventVisible('Test data');
    console.log('Event is visible in the list');
  });
});
