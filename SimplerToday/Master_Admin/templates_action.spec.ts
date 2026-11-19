import { test, expect } from '@playwright/test';
import { AdminTemplatesPage } from '../../pages/AdminTemplatesPage';
import { countRequests } from '../../utils/countRequests';
import { ensureMasterAdminSession, MASTER_ADMIN_SESSION } from '../../utils/masterAdminSession';

/**
 * Admin console - Templates (the global template library), as the Master Admin.
 *
 * Runs on a saved Master Admin session (utils/masterAdminSession.ts), so a run
 * only spends a recovery code when that session has expired.
 *
 * These tests never click Publish: a published template reaches every lawyer.
 * The test template stays a draft and is deleted at the end; deleting a draft is
 * permanent, and it was never published, so no lawyer is affected.
 *
 * Editing a template's details is tested in master_customeTemplate_Edit.spec.ts.
 */

const ADMIN_URL = process.env.ADMIN_URL ?? '';

const CREATE_TEMPLATE = /^\/api\/admin\/templates\/preset$/;
const TEMPLATE        = /^\/api\/admin\/templates\/[a-f0-9]{24}$/;

test.use({ storageState: MASTER_ADMIN_SESSION });

let templatesPage: AdminTemplatesPage;

test.beforeAll(async ({ browser }) => {
  const skipReason = await ensureMasterAdminSession(browser);
  test.skip(skipReason !== null, skipReason ?? '');
});

test.beforeEach(async ({ page }) => {
  templatesPage = new AdminTemplatesPage(page);
  await page.goto(new URL('/dashboard', ADMIN_URL).href);
  await templatesPage.open();
});

test.afterEach(async ({ context }) => {
  // Keep the saved session current: the console rotates its refresh token
  await context.storageState({ path: MASTER_ADMIN_SESSION });

  // A failed test may have left its template behind — remove it
  const cleanup = test.info().annotations.find(a => a.type === 'cleanup');
  if (cleanup?.description && test.info().status !== test.info().expectedStatus) {
    await templatesPage.deleteTemplateIfPresent(cleanup.description);
    await context.storageState({ path: MASTER_ADMIN_SESSION });
  }
});

// ──────────────────────────────────────────────────────────────
// ✅  POSITIVE SCENARIOS
// ──────────────────────────────────────────────────────────────
test.describe('Admin Templates - Positive Scenarios', () => {
  test('Templates page shows the library with create, upload, search and filters', async () => {
    await expect(templatesPage.createCustomButton).toBeVisible();
    await expect(templatesPage.uploadDraftButton).toBeVisible();
    await expect(templatesPage.searchBox).toBeVisible();
    await expect(templatesPage.statusFilter.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(templatesPage.categoryFilter.getByRole('button', { name: 'All categories' })).toHaveAttribute('aria-pressed', 'true');
    for (const column of ['Template', 'Category', 'Status', 'Version']) {
      await expect(templatesPage.table.getByRole('columnheader', { name: column })).toBeVisible();
    }
  });

  test('Status filter shows only templates with that status', async () => {
    for (const status of ['Draft', 'Published', 'Retired'] as const) {
      await templatesPage.filterByStatus(status);
      // e.g. "Published" also covers "Published · Changes not published"
      await expect.poll(async () => (await templatesPage.columnValues('Status')).every(s => s.startsWith(status)),
        { message: `the ${status} filter lists other statuses`, timeout: 15_000 }).toBe(true);
    }
  });

  test('Category filter shows only templates in that category', async () => {
    for (const category of ['Letterhead', 'Document Draft', 'Custom']) {
      await templatesPage.filterByCategory(category);
      await expect.poll(async () => (await templatesPage.columnValues('Category')).every(c => c === category),
        { message: `the ${category} filter lists other categories`, timeout: 15_000 }).toBe(true);
    }
  });

  test('Upload Document Draft opens a file picker for PDF, Word and text files', async ({ page }) => {
    // Playwright catches the picker, so nothing is chosen and nothing is uploaded
    const chooserPromise = page.waitForEvent('filechooser');
    await templatesPage.uploadDraftButton.click();
    const chooser = await chooserPromise;

    expect(chooser.isMultiple()).toBe(true);
    expect(await chooser.element().getAttribute('accept')).toBe('.pdf,.doc,.docx,.txt');
  });

  test('Create a custom template, find it in the list as a Custom draft, and delete it', async ({ page }) => {
    test.setTimeout(120_000);  // create + list checks + delete

    const stamp = Date.now();
    const name  = `QA Template ${stamp}`;

    // If this test fails, afterEach deletes the template by this timestamp
    test.info().annotations.push({ type: 'cleanup', description: String(stamp) });

    // --- Create: the template is saved as a draft and its page opens ---
    const createRequests = countRequests(page, 'POST', CREATE_TEMPLATE);
    await templatesPage.createCustomTemplate(name);
    await expect(templatesPage.templateAdded).toBeVisible({ timeout: 15_000 });
    expect(createRequests(), 'Save Preset Design sent no create request').toBe(1);
    await expect(page).toHaveURL(/\/templates\/[a-f0-9]{24}$/);

    await expect(templatesPage.detailsHeading).toHaveText(name);
    await expect(templatesPage.detailsStatus('Draft')).toBeVisible();
    await expect(templatesPage.publishButton).toBeVisible();
    await expect(templatesPage.deleteButton).toBeVisible();
    await templatesPage.versionsTab.click();
    await expect(templatesPage.notPublishedYet).toBeVisible();

    // --- In the list it is a Custom draft: not under Published, listed under Draft ---
    await templatesPage.backToListLink.click();
    await templatesPage.search(name);
    await templatesPage.filterByStatus('Published');
    await expect(templatesPage.noMatches).toBeVisible({ timeout: 15_000 });
    await templatesPage.filterByStatus('Draft');
    await expect(templatesPage.row(name)).toContainText('Custom', { timeout: 15_000 });
    await expect(templatesPage.row(name)).toContainText('Draft');

    // --- Delete: Cancel keeps it; Delete removes it permanently ---
    await templatesPage.openTemplate(name);
    const deleteRequests = countRequests(page, 'DELETE', TEMPLATE);
    await templatesPage.deleteButton.click();
    await expect(templatesPage.deleteDialog).toBeVisible();
    await templatesPage.deleteDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(templatesPage.deleteDialog).toBeHidden();
    await expect(templatesPage.detailsHeading).toHaveText(name);
    expect(deleteRequests(), 'Cancel still deleted the template').toBe(0);

    await templatesPage.deleteTemplate();
    await expect(templatesPage.templateDeleted).toBeVisible({ timeout: 15_000 });
    expect(deleteRequests(), 'Delete sent no request').toBe(1);
    await expect(page).toHaveURL(/\/templates$/);
    await templatesPage.search(name);
    await expect(templatesPage.noMatches).toBeVisible({ timeout: 15_000 });
  });
});

// ──────────────────────────────────────────────────────────────
// ❌  NEGATIVE SCENARIOS
// ──────────────────────────────────────────────────────────────
test.describe('Admin Templates - Negative Scenarios', () => {
  test('Leaving "Create a template" without saving creates nothing', async ({ page }) => {
    const name = `QA Template Unsaved ${Date.now()}`;
    const createRequests = countRequests(page, 'POST', CREATE_TEMPLATE);

    await templatesPage.createCustomButton.click();
    await templatesPage.createCustomTemplateButton.click();
    await templatesPage.templateNameField.fill(name);
    await templatesPage.backToSelectionButton.click();
    await templatesPage.createCancelButton.click();

    await expect(templatesPage.createDialog).toBeHidden();
    expect(createRequests(), 'leaving the dialog still created a template').toBe(0);
  });

  test('Search with no match shows "Nothing matches those filters", and clearing it brings the list back', async () => {
    await templatesPage.search(`no-such-template-${Date.now()}`);
    await expect(templatesPage.noMatches).toBeVisible({ timeout: 15_000 });
    expect(await templatesPage.columnValues('Template')).toEqual([]);

    await templatesPage.search('');
    await expect(templatesPage.noMatches).toBeHidden({ timeout: 15_000 });
    expect((await templatesPage.columnValues('Template')).length).toBeGreaterThan(0);
  });

  test('A template link that does not exist says so', async ({ page }) => {
    await page.goto(new URL('/templates/000000000000000000000000', ADMIN_URL).href);
    await expect(templatesPage.noLongerExists).toBeVisible({ timeout: 15_000 });
    await expect(templatesPage.editDetailsButton).toBeHidden();
  });
});
