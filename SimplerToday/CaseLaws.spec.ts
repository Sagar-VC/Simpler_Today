import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { WorkspacePage } from '../pages/WorkspacePage';
import { RelevantPartiesPage } from '../pages/RelevantPartiesPage';


declare const process: { env: { TEST_EMAIL?: string; TEST_PASSWORD?: string } };
const EMAIL    = process.env.TEST_EMAIL    ?? '';
const PASSWORD = process.env.TEST_PASSWORD ?? '';

test.describe('Workspace - Positive Scenarios', () => {
  // Override the global 30 s timeout for every test in this suite.
  // waitAndClickBackToDashboard can take up to 60 s (AI workspace preparation).
  // 3 minutes gives comfortable headroom for that plus all other steps.
  test.beforeEach(() => {
    test.setTimeout(180_000);
  });

  test('Create Workspace with File Upload with new party', async ({ page }) => {
    // Relevant Parties AI extraction can take a few minutes after workspace creation.
    test.setTimeout(300_000);

    const loginPage       = new LoginPage(page);
    const dashboardPage   = new DashboardPage(page);
    const workspacePage   = new WorkspacePage(page);
    const relevantParties = new RelevantPartiesPage(page);

    // --- Step 1: Login ---
    await loginPage.goto();
    await loginPage.login(EMAIL, PASSWORD);
    await loginPage.skipTour();

    // --- Step 2: Open New Workspace dialog and fill details ---
    await dashboardPage.clickNewWorkspace();
    await workspacePage.fillWorkspaceName('New Client 101');
    await workspacePage.selectRole('petitioner');

    // --- Step 3: Upload file ---
    await workspacePage.expandUploadSection();
    await workspacePage.uploadFile('C:/Users/Sagar Panchal/Downloads/Analysis-Report-v1 (1).pdf');
    await workspacePage.waitForFileUploaded('Analysis-Report-v1 (1).pdf');

    // --- Step 4: Create workspace ---
    await workspacePage.clickCreateWorkspace();

    // --- Step 5: Verify workspace creation ---
    await expect(workspacePage.getWorkspaceName()).toHaveText('New Client 101');

    // --- Step 6: Navigate to Relevant Parties tab ---
    await relevantParties.navigateToSection();
    await relevantParties.waitForPartiesReady();
    await relevantParties.verifyAddPartyButtonVisible();

    // --- Step 7: Open Add Party form ---
    await relevantParties.clickAddParty();
    await relevantParties.verifyAddPartyFormVisible();
    await relevantParties.verifyRequiredFieldsPresent();

    // --- Step 8: Fill required fields plus contact, email, and Official ID upload ---
    const partyName     = `Test Witness ${Date.now()}`;
    const contactNumber = `98${Math.floor(10_000_000 + Math.random() * 89_999_999)}`; // random 10-digit number
    const email          = `test.${Date.now()}@example.com`;

    await relevantParties.fillPartyForm({
      name:    partyName,
      role:    'Witness',
      details: 'Added via automated test to verify the Relevant Parties workflow.',
      contact: contactNumber,
      email:   email,
      officialIdFilePath: 'C:/Users/Sagar Panchal/Downloads/Analysis-Report-v1 (1).pdf',
    });
    await relevantParties.verifyOfficialIdUploaded();
    await relevantParties.clickSaveParty();

    // --- Step 9: Verify the new party appears in the Relevant Parties list with the entered details ---
    await relevantParties.verifyPartyDetails(partyName, { contact: contactNumber, email });
  });
});
