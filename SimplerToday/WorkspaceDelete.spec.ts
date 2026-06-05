import { test } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { WorkspacePage } from '../pages/WorkspacePage';

test.describe('Workspace - Delete Scenarios', () => {

  test('Delete Workspace', async ({ page }) => {
    test.setTimeout(360_000);

    const loginPage     = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const workspacePage = new WorkspacePage(page);

    const timestamp   = Date.now();
    const initialName = `Test_Create_${timestamp}`;

    // Step 1: Login
    await loginPage.goto();
    await loginPage.login('xetey48662@fixscal.com', 'Test@123');
    await loginPage.skipTour();

    // Step 2: Create a new workspace
    await dashboardPage.clickNewWorkspace();
    await workspacePage.fillWorkspaceName(initialName);
    await workspacePage.selectRole('petitioner');
    await workspacePage.clickCreateWorkspace();
    await workspacePage.waitForPreparationScreen();
    await workspacePage.waitAndClickBackToDashboard();
    await dashboardPage.waitForWorkspaceCard(0);

    // Step 3: Search for the created workspace and delete it
    await dashboardPage.searchWorkspaces(initialName);
    await dashboardPage.openCardMenu(0);
    await workspacePage.clickDeleteWorkspace();
    await workspacePage.confirmDelete();

    // Step 4: Validate the deleted workspace no longer appears in search
    await dashboardPage.searchWorkspaces(initialName);
    await dashboardPage.verifyNoWorkspaces();
  });
});
