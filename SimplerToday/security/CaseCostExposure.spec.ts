import { test, expect, Page } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { DashboardPage } from '../../pages/DashboardPage';
import { WorkspacePage } from '../../pages/WorkspacePage';

/**
 * A01:2021 - Broken Access Control (data exposure).
 *
 * QA verification for SIM-107 ("Hide the AI cost rollup from lawyers on the
 * case read"). AI cost figures for a case (`workspaceCostSummary`: token counts,
 * USD totals, last model) are for platform admins only. A lawyer must not
 * receive them from any case response: the listing, opening a case, creating
 * one, or updating one.
 *
 * Note: the ticket names `GET /api/workspace/:id`; the app actually calls
 * `GET /api/workspaces/:id` (plural), which is what this checks.
 *
 * A brand-new case has no AI cost yet, so passing on one would prove nothing.
 * The test therefore uploads a document and waits until the AI has analysed the
 * case before judging the responses.
 *
 * Not covered here (no second account available): a participant who isn't the
 * owner, and the positive control that a platform admin still sees the cost —
 * the platform admin account needs MFA (see AdminMfaEnforcement.spec.ts).
 */

const EMAIL    = process.env.TEST_EMAIL    ?? '';
const PASSWORD = process.env.TEST_PASSWORD ?? '';

const FILE_PATH  = 'C:/Users/Sagar Panchal/Downloads/Analysis-Report-v1 (1).pdf';
const FILE_NAME  = 'Analysis-Report-v1 (1).pdf';
const COST_FIELD = 'workspaceCostSummary';

/** Lawyer-facing case endpoints: the listing, and a single case read/create/update. */
const CASE_ENDPOINT = /^\/api\/workspaces(\/[a-f0-9]{24})?$/;
const CASE_READ     = /^\/api\/workspaces\/[a-f0-9]{24}$/;

interface CaseResponse { method: string; path: string; body: unknown }

/** Paths (e.g. "data.workspaceCostSummary") of every key with this name, at any depth. */
function findKey(value: unknown, key: string, path = ''): string[] {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([k, v]) => {
    const here = path ? `${path}.${k}` : k;
    return [...(k === key ? [here] : []), ...findKey(v, key, here)];
  });
}

/** Record every JSON answer from the case endpoints for the rest of the test. */
function recordCaseResponses(page: Page): CaseResponse[] {
  const recorded: CaseResponse[] = [];
  page.on('response', async res => {
    const method = res.request().method();
    const path   = new URL(res.url()).pathname;
    if (!CASE_ENDPOINT.test(path) || !['GET', 'POST', 'PATCH'].includes(method)) return;
    try {
      recorded.push({ method, path, body: await res.json() });
    } catch {
      // not a JSON answer (e.g. a redirect) — nothing to inspect
    }
  });
  return recorded;
}

test.describe('Security - AI cost rollup hidden from lawyers (SIM-107)', () => {
  test('A case owner never receives workspaceCostSummary from case responses', async ({ page }) => {
    // Create + AI analysis of the uploaded document (up to ~4 min) + rename.
    test.setTimeout(600_000);

    const loginPage     = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);
    const workspacePage = new WorkspacePage(page);
    const recorded      = recordCaseResponses(page);

    const caseName    = `SIM-107 Cost Check ${Date.now()}`;
    const renamedCase = `${caseName} Renamed`;

    // --- Step 1: Login and create a case with a document, so the AI analyses it ---
    await loginPage.goto();
    await loginPage.login(EMAIL, PASSWORD);
    await loginPage.skipTour();

    await dashboardPage.clickNewWorkspace();
    await workspacePage.fillWorkspaceName(caseName);
    await workspacePage.selectRole('petitioner');
    await workspacePage.expandUploadSection();
    await workspacePage.uploadFile(FILE_PATH);
    await workspacePage.waitForFileUploaded(FILE_NAME);
    await workspacePage.clickCreateWorkspace();
    await workspacePage.waitForPreparationScreen();
    await workspacePage.waitAndClickBackToDashboard();

    // --- Step 2: Open the case once the AI has finished preparing it ---
    if (!page.url().includes('/workspace/')) {
      await dashboardPage.waitForWorkspaceCard(0);
      await dashboardPage.openWorkspace(0, caseName); // waits out the "still preparing" overlay
    }
    await workspacePage.skipTourInWorkspace();

    // --- Step 3: Read the case as its owner after the AI has worked on it ---
    // Reload until the case read carries AI output (the case summary or the
    // analysis score — both cost AI tokens); only then is there a cost rollup
    // worth leaking.
    let analysed  = false;
    let lastState = 'no case read yet';
    for (let attempt = 0; attempt < 12 && !analysed; attempt++) {
      const caseRead = page.waitForResponse(
        res => CASE_READ.test(new URL(res.url()).pathname) && res.request().method() === 'GET'
      );
      await page.reload();
      const { data } = await (await caseRead).json();
      expect(data?.access?.isOwner, 'expected to read the case as its owner').toBe(true);
      const hasSummary = Boolean(data?.strategySummary?.caseSummary);
      const hasScore   = typeof data?.analysisReport?.caseResolutionScore === 'number';
      analysed  = hasSummary || hasScore;
      lastState = `case summary: ${hasSummary}, analysis score: ${hasScore}, documents scored: ${data?.documentsWithScoreCount}`;
      if (!analysed) await page.waitForTimeout(20_000);
    }
    expect(analysed, `the AI never worked on the case, so the cost check would prove nothing (${lastState})`).toBe(true);

    // --- Step 4: Update the case (metadata PATCH) from the dashboard ---
    await workspacePage.backToWorkspaceList();
    await dashboardPage.searchWorkspaces(caseName);
    await dashboardPage.openCardMenu(0);
    await workspacePage.clickEditWorkspace();
    await workspacePage.updateWorkspaceName(renamedCase);
    await dashboardPage.searchWorkspaces(renamedCase);
    await dashboardPage.verifyWorkspaceVisible(renamedCase);

    // --- Step 5: No case response may contain the cost rollup ---
    const seen = (method: string, path: RegExp) => recorded.some(r => r.method === method && path.test(r.path));
    expect(seen('POST', /^\/api\/workspaces$/), 'the create answer was not captured').toBe(true);
    expect(seen('GET', CASE_READ), 'no case read was captured').toBe(true);
    expect(seen('PATCH', CASE_READ), 'the update answer was not captured').toBe(true);

    const leaks = recorded.flatMap(r => findKey(r.body, COST_FIELD).map(p => `${r.method} ${r.path} → ${p}`));
    console.log(`Checked ${recorded.length} case responses for "${COST_FIELD}"`);
    expect(leaks, `AI cost data was sent to a lawyer (SIM-107):\n${leaks.join('\n')}`).toEqual([]);
  });
});
