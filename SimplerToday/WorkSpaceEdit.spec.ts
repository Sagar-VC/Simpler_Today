import { test } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { WorkspacePage } from '../pages/WorkspacePage';

// ── Shared setup helper ────────────────────────────────────────────────────
async function loginAndCreateWorkspace(
  page: import('@playwright/test').Page,
  name: string
) {
  const loginPage     = new LoginPage(page);
  const dashboardPage = new DashboardPage(page);
  const workspacePage = new WorkspacePage(page);

  await loginPage.goto();
  await loginPage.login('picayox936@okcpress.com', 'Test@123');
  await loginPage.skipTour();

  await dashboardPage.clickNewWorkspace();
  await workspacePage.fillWorkspaceName(name);
  await workspacePage.selectRole('petitioner');
  await workspacePage.clickCreateWorkspace();
  await workspacePage.waitForPreparationScreen();
  await workspacePage.waitAndClickBackToDashboard();
  await dashboardPage.waitForWorkspaceCard(0);

  return { loginPage, dashboardPage, workspacePage };
}

// ──────────────────────────────────────────────────────────────────────────
// ✅  POSITIVE SCENARIOS
// ──────────────────────────────────────────────────────────────────────────
test.describe('Workspace - Edit Scenarios', () => {

  test('Create and Edit Workspace Name', async ({ page }) => {
    test.setTimeout(360_000);

    const timestamp   = Date.now();
    const initialName = `Test_Create_${timestamp}`;
    const updatedName = `Test_Updated_${timestamp}`;

    const { dashboardPage, workspacePage } =
      await loginAndCreateWorkspace(page, initialName);

    // Search for the created workspace and edit its name
    await dashboardPage.searchWorkspaces(initialName);
    await dashboardPage.openCardMenu(0);
    await workspacePage.clickEditWorkspace();
    await workspacePage.updateWorkspaceName(updatedName);

    // Validate the updated name appears in search
    await dashboardPage.searchWorkspaces(updatedName);
    await dashboardPage.verifyWorkspaceVisible(updatedName);
  });

});

// ──────────────────────────────────────────────────────────────────────────
// ❌  NEGATIVE SCENARIOS
// ──────────────────────────────────────────────────────────────────────────
test.describe('Workspace - Edit Negative Scenarios', () => {

  test('Update button is disabled when workspace name is cleared', async ({ page }) => {
    test.setTimeout(360_000);

    const initialName = `Test_Create_${Date.now()}`;
    const { dashboardPage, workspacePage } =
      await loginAndCreateWorkspace(page, initialName);

    // Open edit dialog 
    await dashboardPage.searchWorkspaces(initialName);
    await dashboardPage.openCardMenu(0);
    await workspacePage.clickEditWorkspace();

    // Clear the name field — save should be blocked
    await workspacePage.fillWorkspaceName('');
    await workspacePage.verifyUpdateButtonDisabled();
  });

  test('Update button is disabled with whitespace-only name', async ({ page }) => {
    test.setTimeout(360_000);

    const initialName = `Test_Create_${Date.now()}`;
    const { dashboardPage, workspacePage } =
      await loginAndCreateWorkspace(page, initialName);

    // Open edit dialog
    await dashboardPage.searchWorkspaces(initialName);
    await dashboardPage.openCardMenu(0);
    await workspacePage.clickEditWorkspace();

    // Fill with spaces only — should be treated as empty
    await workspacePage.fillWorkspaceName('     ');
    await workspacePage.verifyUpdateButtonDisabled();
  });

  test('Cancelling edit does not change the workspace name', async ({ page }) => {
    test.setTimeout(360_000);

    const timestamp   = Date.now();
    const initialName = `Test_Create_${timestamp}`;
    const changedName = `Test_Changed_${timestamp}`;

    const { dashboardPage, workspacePage } =
      await loginAndCreateWorkspace(page, initialName);

    // Open edit dialog and type a new name, then cancel
    await dashboardPage.searchWorkspaces(initialName);
    await dashboardPage.openCardMenu(0);
    await workspacePage.clickEditWorkspace();
    await workspacePage.fillWorkspaceName(changedName);
    await workspacePage.cancelEditWorkspace();

    // Original name must still be searchable
    await dashboardPage.searchWorkspaces(initialName);
    await dashboardPage.verifyWorkspaceVisible(initialName);
  });

});
