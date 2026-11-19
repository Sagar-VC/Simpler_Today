import { test, expect } from '@playwright/test';
import { AdminTemplatesPage } from '../../pages/AdminTemplatesPage';
import { countRequests } from '../../utils/countRequests';
import { ensureMasterAdminSession, MASTER_ADMIN_SESSION } from '../../utils/masterAdminSession';

/**
 * Admin console - Templates → a template's "Edit details" (name and category), as the Master Admin.
 *
 * Runs on a saved Master Admin session (utils/masterAdminSession.ts), so a run
 * only spends a recovery code when that session has expired.
 *
 * Each test creates its own custom template (a draft) and deletes it again
 * afterwards; creating and deleting are tested in templates_action.spec.ts.
 * These tests never click Publish: a published template reaches every lawyer.
 *
 * Covers the scenarios of the main app's CustomeTemplate_Edit.spec.ts as well; its
 * search for a template that doesn't exist is in templates_action.spec.ts.
 */

const ADMIN_URL = process.env.ADMIN_URL ?? '';

const TEMPLATE = /^\/api\/admin\/templates\/[a-f0-9]{24}$/;

const CATEGORIES = ['Letterhead', 'Document Draft', 'Supreme Court', 'High Court', 'District Court', 'Tribunal', 'Custom'];

test.use({ storageState: MASTER_ADMIN_SESSION });

let templatesPage: AdminTemplatesPage;
let stamp: string;
let name: string;

test.beforeAll(async ({ browser }) => {
  const skipReason = await ensureMasterAdminSession(browser);
  test.skip(skipReason !== null, skipReason ?? '');
});

test.beforeEach(async ({ page }) => {
  test.setTimeout(90_000);  // create a template + edit it + delete it
  templatesPage = new AdminTemplatesPage(page);
  stamp = String(Date.now());
  name  = `QA Template ${stamp}`;

  await page.goto(new URL('/dashboard', ADMIN_URL).href);
  await templatesPage.open();

  // This test's own template; its page opens after saving
  await templatesPage.createCustomTemplate(name);
  await expect(page).toHaveURL(/\/templates\/[a-f0-9]{24}$/, { timeout: 20_000 });
  await expect(templatesPage.detailsHeading).toHaveText(name);
});

test.afterEach(async ({ context }) => {
  // Keep the saved session current: the console rotates its refresh token
  await context.storageState({ path: MASTER_ADMIN_SESSION });

  // Delete this test's template, under whichever name it ended up with
  await templatesPage.deleteTemplateIfPresent(stamp);
  await context.storageState({ path: MASTER_ADMIN_SESSION });
});

// ──────────────────────────────────────────────────────────────
// ✅  POSITIVE SCENARIOS
// ──────────────────────────────────────────────────────────────
test.describe('Admin Template Edit - Positive Scenarios', () => {
  test('Edit details shows the current name and category, and lists every category', async () => {
    await templatesPage.editDetailsButton.click();
    await expect(templatesPage.editNameField).toHaveValue(name);
    await expect(templatesPage.editCategoryField).toHaveText('Custom');

    await templatesPage.editCategoryField.click();
    await expect(templatesPage.categoryOptions).toHaveText(CATEGORIES);
    // Picking the current category again closes the list without a change
    await templatesPage.categoryOption('Custom').click();
    await expect(templatesPage.editCategoryField).toHaveText('Custom');
    await templatesPage.editCancelButton.click();
    await expect(templatesPage.editDialog).toBeHidden();
  });

  test('Rename: the new name is saved without surrounding spaces, kept after a reload, and the list finds it only by the new name', async ({ page }) => {
    const renamed = `QA Template Renamed ${stamp}`;
    const updateRequests = countRequests(page, 'PATCH', TEMPLATE);

    // --- Save a new name typed with spaces around it ---
    await templatesPage.renameTemplate(`  ${renamed}  `);
    await expect(templatesPage.templateRenamed).toBeVisible({ timeout: 15_000 });
    await expect(templatesPage.editDialog).toBeHidden();
    await expect(templatesPage.detailsHeading).toHaveText(renamed);
    expect(updateRequests(), 'Save details sent no update').toBe(1);

    // --- After a reload the new name is still there, without the spaces ---
    await page.reload();
    await expect(templatesPage.detailsHeading).toHaveText(renamed, { timeout: 15_000 });
    await templatesPage.editDetailsButton.click();
    await expect(templatesPage.editNameField).toHaveValue(renamed);
    await templatesPage.editCancelButton.click();

    // --- The list finds it by the new name, not the old one ---
    await templatesPage.backToListLink.click();
    await templatesPage.search(name);
    await expect(templatesPage.noMatches).toBeVisible({ timeout: 15_000 });
    await templatesPage.search(renamed);
    await expect(templatesPage.row(renamed)).toBeVisible({ timeout: 15_000 });
  });

  test('Change the category: the page, the list and the category filter show the new one', async ({ page }) => {
    const updateRequests = countRequests(page, 'PATCH', TEMPLATE);

    // --- Custom → High Court, shown on the page and kept after a reload ---
    await templatesPage.changeCategory('High Court');
    await expect(templatesPage.categoryChanged).toBeVisible({ timeout: 15_000 });
    await expect(templatesPage.detailsCategory('High Court')).toBeVisible();
    expect(updateRequests(), 'Save details sent no update').toBe(1);
    await page.reload();
    await expect(templatesPage.detailsCategory('High Court')).toBeVisible({ timeout: 15_000 });

    // --- In the list: High Court in its row, listed under High Court, no longer under Custom ---
    await templatesPage.backToListLink.click();
    await templatesPage.search(name);
    await expect(templatesPage.row(name)).toContainText('High Court', { timeout: 15_000 });
    await templatesPage.filterByCategory('High Court');
    await expect(templatesPage.row(name)).toBeVisible({ timeout: 15_000 });
    await templatesPage.filterByCategory('Custom');
    await expect(templatesPage.noMatches).toBeVisible({ timeout: 15_000 });
  });

  test('A name can be up to 200 characters: typing stops there, and all 200 are saved', async () => {
    const longName = `${name} ${'x'.repeat(250)}`;

    await templatesPage.editDetailsButton.click();
    await templatesPage.editNameField.fill(longName);
    await expect(templatesPage.editNameField).toHaveValue(longName.slice(0, 200));
    await templatesPage.saveDetailsButton.click();

    await expect(templatesPage.templateRenamed).toBeVisible({ timeout: 15_000 });
    await expect(templatesPage.detailsHeading).toHaveText(longName.slice(0, 200));
  });

  test('Rename with Enter: the new name is saved, and with the search cleared the full list shows it', async ({ page }) => {
    const renamed = `QA Template Renamed ${stamp}`;
    const updateRequests = countRequests(page, 'PATCH', TEMPLATE);

    // --- Enter in the Name field saves, like Save details ---
    await templatesPage.editDetailsButton.click();
    await templatesPage.editNameField.fill(renamed);
    await templatesPage.editNameField.press('Enter');
    await expect(templatesPage.templateRenamed).toBeVisible({ timeout: 15_000 });
    await expect(templatesPage.editDialog).toBeHidden();
    await expect(templatesPage.detailsHeading).toHaveText(renamed);
    expect(updateRequests(), 'Enter sent no update').toBe(1);

    // --- The search finds it by the new name ---
    await templatesPage.backToListLink.click();
    await templatesPage.search(renamed);
    await expect(templatesPage.row(renamed)).toBeVisible({ timeout: 15_000 });

    // --- With the search cleared it is in the full list (last-updated first, so on the first page) ---
    await templatesPage.search('');
    await expect.poll(async () => (await templatesPage.columnValues('Template')).length,
      { message: 'clearing the search did not bring the full list back', timeout: 15_000 }).toBeGreaterThan(1);
    await expect(templatesPage.row(renamed)).toBeVisible();
  });
});

// ──────────────────────────────────────────────────────────────
// ❌  NEGATIVE SCENARIOS
// ──────────────────────────────────────────────────────────────
test.describe('Admin Template Edit - Negative Scenarios', () => {
  test('A blank name (empty or only spaces) is refused and the old name is kept', async ({ page }) => {
    const updateRequests = countRequests(page, 'PATCH', TEMPLATE);

    for (const blank of ['', '   ']) {
      await templatesPage.editDetailsButton.click();
      await templatesPage.editNameField.fill(blank);
      await expect(templatesPage.nameRequired).toBeHidden();
      await templatesPage.saveDetailsButton.click();

      await expect(templatesPage.nameRequired, `the name "${blank}" was not refused`).toBeVisible();
      await expect(templatesPage.editNameField).toHaveAttribute('aria-invalid', 'true');
      await expect(templatesPage.editDialog).toBeVisible();
      await templatesPage.editCancelButton.click();
      await expect(templatesPage.editDialog).toBeHidden();
    }

    expect(updateRequests(), 'a blank name was sent to the server').toBe(0);
    await expect(templatesPage.detailsHeading).toHaveText(name);
  });

  test('A blank name submitted with Enter is refused, and the list still finds the old name', async ({ page }) => {
    const updateRequests = countRequests(page, 'PATCH', TEMPLATE);

    for (const blank of ['', '   ']) {
      await templatesPage.editDetailsButton.click();
      await templatesPage.editNameField.fill(blank);
      await templatesPage.editNameField.press('Enter');

      await expect(templatesPage.nameRequired, `the name "${blank}" was not refused`).toBeVisible();
      await expect(templatesPage.editNameField).toHaveAttribute('aria-invalid', 'true');
      await expect(templatesPage.editDialog).toBeVisible();
      await templatesPage.editCancelButton.click();
      await expect(templatesPage.editDialog).toBeHidden();
    }

    expect(updateRequests(), 'a blank name was sent to the server').toBe(0);
    await expect(templatesPage.detailsHeading).toHaveText(name);
    await templatesPage.backToListLink.click();
    await templatesPage.search(name);
    await expect(templatesPage.row(name)).toBeVisible({ timeout: 15_000 });
  });

  test('Cancel, Close and Escape each discard a typed name', async ({ page }) => {
    const updateRequests = countRequests(page, 'PATCH', TEMPLATE);
    const ways = [
      { way: 'Cancel', leave: () => templatesPage.editCancelButton.click() },
      { way: 'Close',  leave: () => templatesPage.editCloseButton.click() },
      { way: 'Escape', leave: () => page.keyboard.press('Escape') },
    ];

    for (const { way, leave } of ways) {
      await templatesPage.editDetailsButton.click();
      await templatesPage.editNameField.fill(`QA Template Renamed ${stamp}`);
      await leave();
      await expect(templatesPage.editDialog, `${way} did not close Edit details`).toBeHidden();
      await expect(templatesPage.detailsHeading).toHaveText(name);
    }
    expect(updateRequests(), 'leaving Edit details still saved the change').toBe(0);

    // Edit details opens with the saved name again, not a discarded one
    await templatesPage.editDetailsButton.click();
    await expect(templatesPage.editNameField).toHaveValue(name);
    await templatesPage.editCancelButton.click();
  });

  test('After renaming twice, neither earlier name finds the template, and the full list shows only the latest name', async ({ page }) => {
    test.setTimeout(120_000);  // two renames + five searches + delete
    // v1 / v2: neither name is part of the other, so a search for one can't find both
    const first  = `QA Template Renamed ${stamp} v1`;
    const latest = `QA Template Renamed ${stamp} v2`;
    const updateRequests = countRequests(page, 'PATCH', TEMPLATE);

    for (const newName of [first, latest]) {
      await templatesPage.renameTemplate(newName);
      await expect(templatesPage.editDialog).toBeHidden({ timeout: 15_000 });
      await expect(templatesPage.detailsHeading).toHaveText(newName);
    }
    await expect.poll(updateRequests, { message: 'each rename should send one update' }).toBe(2);

    // --- Neither earlier name finds it. Searching the latest name in between
    // makes each "Nothing matches" a fresh result, not the previous search's ---
    await templatesPage.backToListLink.click();
    for (const oldName of [name, first]) {
      await templatesPage.search(latest);
      await expect(templatesPage.row(latest)).toBeVisible({ timeout: 15_000 });
      await templatesPage.search(oldName);
      await expect(templatesPage.noMatches, `the old name "${oldName}" still finds the template`).toBeVisible({ timeout: 15_000 });
    }

    // --- With the search cleared, the full list has one row for it, under the latest name ---
    await templatesPage.search('');
    await expect.poll(async () => (await templatesPage.columnValues('Template')).length,
      { message: 'clearing the search did not bring the full list back', timeout: 15_000 }).toBeGreaterThan(1);
    await expect(templatesPage.row(stamp)).toHaveCount(1);
    await expect(templatesPage.row(stamp)).toContainText(latest);
  });
});
