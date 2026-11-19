import { test, expect } from '@playwright/test';
import { AdminUsersPage } from '../../pages/AdminUsersPage';
import { countRequests } from '../../utils/countRequests';
import { ensureMasterAdminSession, MASTER_ADMIN_SESSION } from '../../utils/masterAdminSession';

/**
 * Admin console - Users page, as the Master Admin.
 *
 * Runs on a saved Master Admin session (utils/masterAdminSession.ts), so a run
 * only spends a recovery code when that session has expired.
 *
 * Test users get an @example.com address, a domain that never receives mail,
 * so the invitation the console sends goes nowhere. The created user is
 * renamed (Details → Edit) and deleted again at the end of the test.
 */

const ADMIN_URL = process.env.ADMIN_URL ?? '';

const CREATE_USER = /^\/api\/admin\/users$/;
const UPDATE_USER = /^\/api\/admin\/users\/[a-f0-9]{24}$/;

test.use({ storageState: MASTER_ADMIN_SESSION });

let usersPage: AdminUsersPage;

test.beforeAll(async ({ browser }) => {
  const skipReason = await ensureMasterAdminSession(browser);
  test.skip(skipReason !== null, skipReason ?? '');
});

test.beforeEach(async ({ page }) => {
  usersPage = new AdminUsersPage(page);
  await page.goto(new URL('/dashboard', ADMIN_URL).href);
  await usersPage.open();
});

test.afterEach(async ({ context }) => {
  // Keep the saved session current: the console rotates its refresh token
  await context.storageState({ path: MASTER_ADMIN_SESSION });

  // A failed test may have left its user behind — remove it
  const cleanup = test.info().annotations.find(a => a.type === 'cleanup');
  if (cleanup?.description && test.info().status !== test.info().expectedStatus) {
    await usersPage.deleteUserIfPresent(cleanup.description);
    await context.storageState({ path: MASTER_ADMIN_SESSION });
  }
});

// ──────────────────────────────────────────────────────────────
// ✅  POSITIVE SCENARIOS
// ──────────────────────────────────────────────────────────────
test.describe('Admin Users - Positive Scenarios', () => {
  test('Users page lists users with search and Add user', async ({ page }) => {
    await expect(usersPage.addUserButton).toBeVisible();
    await expect(usersPage.searchBox).toBeVisible();
    for (const column of ['Name', 'Email', 'Role', 'Status']) {
      await expect(page.getByRole('columnheader', { name: column })).toBeVisible();
    }
    await expect(page.getByRole('row').nth(1)).toBeVisible();
  });

  test('Create a user, edit their name from the details page, verify it is saved, and delete them', async ({ page }) => {
    test.setTimeout(120_000);  // create + two edits + reload + delete

    const stamp   = Date.now();
    const name    = `QA User ${stamp}`;
    const renamed = `QA Renamed ${stamp}`;
    const email   = `qa.user.${stamp}@example.com`;

    // If this test fails, afterEach deletes the user by this email
    test.info().annotations.push({ type: 'cleanup', description: email });

    // --- Create ---
    await usersPage.createUser(name, email);
    await expect(usersPage.userCreated).toBeVisible({ timeout: 15_000 });
    await expect(usersPage.createDialog).toBeHidden();

    // --- Find by search ---
    await usersPage.search(name);
    await expect(usersPage.row(email)).toBeVisible({ timeout: 15_000 });

    // --- Details show the email ---
    await usersPage.openDetails(email);
    await expect(usersPage.detailsPanel(name).getByText(email)).toBeVisible();

    // --- Edit: the form shows the current name; the email can't be changed ---
    await usersPage.openEdit(name);
    await expect(usersPage.editNameField).toHaveValue(name);
    await expect(usersPage.editEmailField).toHaveValue(email);
    await expect(usersPage.editEmailField).toBeDisabled();

    // --- Cancel discards a typed change and returns to the details, still showing the old name ---
    const updateRequests = countRequests(page, 'PUT', UPDATE_USER);
    await usersPage.editNameField.fill(renamed);
    await usersPage.editCancelButton.click();
    await expect(usersPage.editDialog).toBeHidden();
    await expect(usersPage.detailsPanel(name)).toBeVisible();
    expect(updateRequests(), 'Cancel still saved the change').toBe(0);

    // --- Save a new name (Edit again from the same details) ---
    await usersPage.openEdit(name);
    await usersPage.editNameField.fill(renamed);
    await usersPage.saveChangesButton.click();
    await expect(usersPage.editDialog).toBeHidden({ timeout: 15_000 });
    await expect(usersPage.userUpdated).toBeVisible();
    expect(updateRequests(), 'Save changes sent no update').toBe(1);

    // The details panel reopens after saving and should show the new name.
    // Soft: a stale panel is reported, but the test still checks the save and cleans up.
    await expect.soft(
      usersPage.detailsPanel(renamed),
      'after "Save changes" the details panel still shows the old name (it only updates after a reload)'
    ).toBeVisible({ timeout: 10_000 });
    await usersPage.closeDetails();

    // --- The change is saved: after a reload the list and details show the new name ---
    await page.reload();
    await expect(usersPage.heading).toBeVisible({ timeout: 15_000 });
    await usersPage.search(renamed);
    await expect(usersPage.row(email)).toContainText(renamed, { timeout: 15_000 });
    await expect(usersPage.row(email)).not.toContainText(name);
    await usersPage.openDetails(email);
    await expect(usersPage.detailsPanel(renamed).getByText(email)).toBeVisible();
    await usersPage.closeDetails();

    // --- Delete (also keeps dev free of test users) ---
    await usersPage.deleteUser(renamed);
    await usersPage.search(renamed);
    await expect(usersPage.row(email)).toBeHidden({ timeout: 15_000 });
  });
});

// ──────────────────────────────────────────────────────────────
// ❌  NEGATIVE SCENARIOS
// ──────────────────────────────────────────────────────────────
test.describe('Admin Users - Negative Scenarios', () => {
  test('Create user with empty fields shows required messages', async ({ page }) => {
    const createRequests = countRequests(page, 'POST', CREATE_USER);
    await usersPage.addUserButton.click();
    await usersPage.createUserButton.click();

    await expect(usersPage.dialogError('Name must be at least 2 characters')).toBeVisible();
    await expect(usersPage.dialogError('Email is required')).toBeVisible();
    await expect(usersPage.createDialog).toBeVisible();
    expect(createRequests(), 'the form was submitted with empty fields').toBe(0);
  });

  test('Create user with a one-letter name and an invalid email is refused', async ({ page }) => {
    const createRequests = countRequests(page, 'POST', CREATE_USER);
    await usersPage.createUser('Q', 'not-an-email');

    await expect(usersPage.dialogError('Name must be at least 2 characters')).toBeVisible();
    await expect(usersPage.dialogError('Enter a valid email')).toBeVisible();
    expect(createRequests(), 'the form was submitted with invalid values').toBe(0);
  });

  test('Cancel closes the dialog without creating a user', async ({ page }) => {
    const createRequests = countRequests(page, 'POST', CREATE_USER);
    await usersPage.addUserButton.click();
    await usersPage.nameField.fill('QA Cancelled User');
    await usersPage.emailField.fill('qa.cancelled@example.com');
    await usersPage.cancelButton.click();

    await expect(usersPage.createDialog).toBeHidden();
    expect(createRequests(), 'Cancel still sent the form').toBe(0);
  });
});
