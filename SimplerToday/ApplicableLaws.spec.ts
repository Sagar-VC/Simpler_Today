import { test, Page } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { WorkspacePage } from '../pages/WorkspacePage';
import { ApplicableLawsPage } from '../pages/ApplicableLawsPage';

test.use({ trace: 'off', video: 'off' });

const EMAIL    = process.env.TEST_EMAIL    ?? '';
const PASSWORD = process.env.TEST_PASSWORD ?? '';

/**
 * Scans workspace cards 0–9 and opens the first one whose Applicable Laws
 * Intelligence Panel has generated "Relevant Acts & Sections" content.
 *
 * Returns true and leaves the page on the Applicable Laws section of that
 * workspace. Returns false if no qualifying workspace is found — callers
 * should then skip the test.
 *
 * Why scan at runtime: the "Relevant Acts & Sections" panel only renders
 * when the workspace has processed supporting documents. Dashboard card
 * text is NOT a reliable indicator of this — use the actual page state.
 */
async function openWorkspaceWithApplicableLawsSection(page: Page): Promise<boolean> {
  const workspacePage = new WorkspacePage(page);

  for (let i = 0; i <= 9; i++) {
    const card = page.locator(`#case-card-${i}`);
    if (!await card.isVisible({ timeout: 2_000 }).catch(() => false)) continue;

    // Skip cards blocked by the AI-init overlay
    const isBlocked = await card
      .locator('button[aria-label*="still preparing"]')
      .isVisible({ timeout: 500 })
      .catch(() => false);
    if (isBlocked) continue;

    // Open the workspace
    await card.locator('h3').first().click();

    // Dismiss in-workspace tour if it appears
    try {
      const skipBtn = page.getByRole('button', { name: 'Skip Tour' });
      await skipBtn.waitFor({ state: 'visible', timeout: 3_000 });
      await skipBtn.click();
    } catch { /* tour not shown */ }

    // Navigate to Applicable Laws tab
    const actTab = page.locator('#actionable-act_4');
    if (!await actTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await workspacePage.backToWorkspaceList();
      await page.waitForSelector('[id^="case-card-"]', { timeout: 10_000 }).catch(() => {});
      continue;
    }
    await actTab.click();

    // Check if the "Relevant Acts & Sections" panel is present
    const hasSection = await page
      .getByText('Relevant Acts & Sections')
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (hasSection) return true; // Caller can proceed — page is on the section

    // Wrong workspace — return to dashboard and try the next card
    await workspacePage.backToWorkspaceList();
    await page.waitForSelector('[id^="case-card-"]', { timeout: 10_000 }).catch(() => {});
  }

  return false;
}

test.describe('Workspace - Applicable Laws - Positive Scenarios', () => {
  test.beforeEach(() => {
    test.setTimeout(180_000);
  });

  test('Add Applicable Law Manually', async ({ page }) => {
    const loginPage          = new LoginPage(page);
    const applicableLawsPage = new ApplicableLawsPage(page);

    // --- Step 1: Login ---
    await loginPage.goto();
    await loginPage.login(EMAIL, PASSWORD);
    await loginPage.skipTour();

    // --- Step 2: Find a workspace with processed Applicable Laws ---
    const found = await openWorkspaceWithApplicableLawsSection(page);
    test.skip(!found,
      'No workspace has a processed Applicable Laws panel. ' +
      'Upload and process supporting documents in at least one workspace.'
    );

    // --- Step 3: Add a law manually ---
    await applicableLawsPage.clickAdd();
    await applicableLawsPage.clickAddLawManually();
    await applicableLawsPage.selectSection('Short title, extent and');
    await applicableLawsPage.clickAddLaw();

    // --- Step 4: Verify the law appears in the list ---
    await applicableLawsPage.verifyLawVisible('Short title, extent and');
    console.log('Applicable law added and verified successfully');
  });

  test('Remove Applicable Law', async ({ page }) => {
    const loginPage          = new LoginPage(page);
    const applicableLawsPage = new ApplicableLawsPage(page);

    // --- Step 1: Login ---
    await loginPage.goto();
    await loginPage.login(EMAIL, PASSWORD);
    await loginPage.skipTour();

    // --- Step 2: Find a workspace with processed Applicable Laws ---
    const found = await openWorkspaceWithApplicableLawsSection(page);
    test.skip(!found,
      'No workspace has a processed Applicable Laws panel. ' +
      'Upload and process supporting documents in at least one workspace.'
    );

    // --- Step 3: Add a law (test setup) ---
    await applicableLawsPage.clickAdd();
    await applicableLawsPage.clickAddLawManually();
    await applicableLawsPage.selectSection('Short title, extent and');
    await applicableLawsPage.clickAddLaw();
    await applicableLawsPage.verifyLawVisible('Short title, extent and');

    // --- Step 4: Remove the law ---
    await applicableLawsPage.clickRemoveLaw(0);
    await applicableLawsPage.confirmRemoveLaw();

    // --- Step 5: Verify the law is gone ---
    await applicableLawsPage.verifyLawRemoved('Short title, extent and');
    console.log('Applicable law removed successfully');
  });
});
