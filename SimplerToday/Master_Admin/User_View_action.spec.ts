import { test, expect, Page } from '@playwright/test';
import { AdminUsersPage } from '../../pages/AdminUsersPage';
import { countRequests } from '../../utils/countRequests';
import { ensureMasterAdminSession, MASTER_ADMIN_SESSION } from '../../utils/masterAdminSession';

/**
 * Admin console - Users page: the list (tabs, search, status filter, sorting) and
 * the row actions on a user, as the Master Admin.
 *
 * Runs on a saved Master Admin session (utils/masterAdminSession.ts), so a run
 * only spends a recovery code when that session has expired.
 *
 * The row actions run on a test user the test creates itself, with an
 * @example.com address (a domain that never receives mail), so the temporary
 * password from "Reset password & resend invite" goes nowhere. The test user is
 * deleted at the end; it then sits on the Deleted tab for the recovery window.
 */

const ADMIN_URL = process.env.ADMIN_URL ?? '';

/** A request to one user, e.g. POST /api/admin/users/<id>/deactivate */
const userEndpoint = (action = '') => new RegExp(`^/api/admin/users/[a-f0-9]{24}${action}$`);

/** A confirmation dialog: its title, its confirm button, the request it sends and the message shown when done */
interface Confirmation {
  title:    string;
  confirm:  string;
  method:   string;
  endpoint: RegExp;
  done:     string;
}

const RESET_PASSWORD: Confirmation = { title: 'Reset password and resend invite?', confirm: 'Reset password',     method: 'POST',   endpoint: userEndpoint('/reset-password'),  done: 'Temporary password emailed' };
const LOG_OUT_ALL:    Confirmation = { title: 'Log out of every device?',          confirm: 'Log out everywhere', method: 'POST',   endpoint: userEndpoint('/revoke-sessions'), done: 'Signed out of every device' };
const DEACTIVATE:     Confirmation = { title: 'Deactivate this user?',             confirm: 'Deactivate',         method: 'POST',   endpoint: userEndpoint('/deactivate'),      done: 'User deactivated' };
const ACTIVATE:       Confirmation = { title: 'Activate this user?',               confirm: 'Activate',           method: 'POST',   endpoint: userEndpoint('/activate'),        done: 'User activated' };
const DELETE:         Confirmation = { title: 'Delete this user?',                 confirm: 'Delete',             method: 'DELETE', endpoint: userEndpoint(),                   done: 'User deleted' };
const RESTORE:        Confirmation = { title: 'Restore this account?',             confirm: 'Restore',            method: 'POST',   endpoint: userEndpoint('/restore'),         done: 'Account restored' };

/**
 * Open a confirmation dialog and Cancel it: nothing is sent. Then open it again
 * and confirm: the request is sent once and the success message shows.
 */
async function cancelThenConfirm(page: Page, open: () => Promise<void>, c: Confirmation) {
  const requests = countRequests(page, c.method, c.endpoint);
  const dialog   = usersPage.confirmDialog(c.title);

  await open();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  expect(requests(), `Cancel on "${c.title}" still sent the request`).toBe(0);

  await open();
  await dialog.getByRole('button', { name: c.confirm, exact: true }).click();
  await expect(page.getByText(c.done)).toBeVisible({ timeout: 15_000 });
  await expect(dialog).toBeHidden();
  expect(requests(), `"${c.confirm}" sent no request`).toBe(1);
}

/** True when the names are in A→Z (or Z→A) order */
function inOrder(names: string[], order: 'ascending' | 'descending'): boolean {
  // The console compares names character by character, so capitals sort before lower case ("Zoe" before "adam")
  return names.every((n, i) => i === 0 || (order === 'ascending' ? names[i - 1] <= n : names[i - 1] >= n));
}

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
test.describe('Admin User Actions - Positive Scenarios', () => {
  test('Active and Deleted tabs switch between the user list and deleted accounts', async ({ page }) => {
    await expect(usersPage.activeTab).toHaveAttribute('aria-current', 'page');

    await usersPage.deletedTab.click();
    await expect(page).toHaveURL(/\/users\/deleted$/);
    for (const column of ['Account', 'Deleted', 'Recovery window', 'Action']) {
      await expect(page.getByRole('columnheader', { name: column })).toBeVisible();
    }
    await expect(usersPage.searchBox).toBeHidden();  // deleted accounts can't be searched

    await usersPage.activeTab.click();
    await expect(page).toHaveURL(/\/users$/);
    await expect(usersPage.activeTab).toHaveAttribute('aria-current', 'page');
    await expect(usersPage.searchBox).toBeVisible();
  });

  test('Sort by Name orders the list A to Z, then Z to A', async () => {
    await usersPage.sortByNameButton.click();
    await expect(usersPage.nameColumnHeader).toHaveAttribute('aria-sort', 'ascending');
    await expect.poll(async () => inOrder(await usersPage.listedNames(), 'ascending'), { timeout: 15_000 }).toBe(true);

    await usersPage.sortByNameButton.click();
    await expect(usersPage.nameColumnHeader).toHaveAttribute('aria-sort', 'descending');
    await expect.poll(async () => inOrder(await usersPage.listedNames(), 'descending'), { timeout: 15_000 }).toBe(true);
  });

  test('Row actions: view details, reset password, log out everywhere, deactivate, activate, delete and restore', async ({ page }) => {
    test.setTimeout(180_000);  // every action is cancelled once, then confirmed

    const stamp = Date.now();
    const name  = `QA User ${stamp}`;
    const email = `qa.user.${stamp}@example.com`;

    // If this test fails, afterEach deletes the user by this email
    test.info().annotations.push({ type: 'cleanup', description: email });

    await usersPage.createUser(name, email);
    await expect(usersPage.userCreated).toBeVisible({ timeout: 15_000 });
    await usersPage.search(name);
    await expect(usersPage.statusCell(email, 'Active')).toBeVisible({ timeout: 15_000 });

    // --- View details (from the Actions menu): name and email; Escape closes it ---
    // (Users.spec.ts covers opening details by clicking the name, and the Close button)
    const details = usersPage.detailsPanel(name);
    await usersPage.rowAction(name, 'View details');
    await expect(details.getByRole('heading', { name })).toBeVisible();
    await expect(details.getByText(email)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(details).toBeHidden();

    // --- Reset password & resend invite / Log out everywhere: the user stays Active ---
    await cancelThenConfirm(page, () => usersPage.rowAction(name, 'Reset password & resend invite'), RESET_PASSWORD);
    await cancelThenConfirm(page, () => usersPage.rowAction(name, 'Log out everywhere'), LOG_OUT_ALL);
    await expect(usersPage.statusCell(email, 'Active')).toBeVisible();

    // --- Deactivate: the user becomes Suspended ---
    await cancelThenConfirm(page, () => usersPage.rowAction(name, 'Deactivate'), DEACTIVATE);
    await expect(usersPage.statusCell(email, 'Suspended')).toBeVisible();

    // --- The Status filter follows the change ---
    await usersPage.filterByStatus('Active');
    await expect(usersPage.row(email)).toBeHidden({ timeout: 15_000 });
    await expect(usersPage.noUsersFound).toBeVisible();
    await usersPage.filterByStatus('Suspended');
    await expect(usersPage.statusCell(email, 'Suspended')).toBeVisible({ timeout: 15_000 });
    await usersPage.filterByStatus('All statuses');
    await expect(usersPage.statusFilter).toHaveText('All statuses');
    await expect(usersPage.statusCell(email, 'Suspended')).toBeVisible({ timeout: 15_000 });

    // --- Activate (offered instead of Deactivate while Suspended): the user is Active again ---
    await cancelThenConfirm(page, () => usersPage.rowAction(name, 'Activate'), ACTIVATE);
    await expect(usersPage.statusCell(email, 'Active')).toBeVisible();

    // --- Delete: the user leaves the list and appears on the Deleted tab with a recovery window ---
    await cancelThenConfirm(page, () => usersPage.rowAction(name, 'Delete'), DELETE);
    await expect(usersPage.row(email)).toBeHidden({ timeout: 15_000 });
    await usersPage.deletedTab.click();
    await expect(usersPage.row(email)).toBeVisible({ timeout: 15_000 });
    await expect(usersPage.row(email)).toContainText('days left');

    // --- Restore: the user leaves the Deleted tab and is back in the list, Active ---
    await cancelThenConfirm(page, () => usersPage.row(email).getByRole('button', { name: 'Restore' }).click(), RESTORE);
    await expect(usersPage.row(email)).toBeHidden({ timeout: 15_000 });
    await usersPage.activeTab.click();
    await usersPage.search(name);
    await expect(usersPage.statusCell(email, 'Active')).toBeVisible({ timeout: 15_000 });

    // --- Clean up: delete again (the Delete step above already checked the dialog and message) ---
    await usersPage.deleteUser(name);
    await expect(usersPage.row(email)).toBeHidden({ timeout: 15_000 });
  });
});

// ──────────────────────────────────────────────────────────────
// ❌  NEGATIVE SCENARIOS
// ──────────────────────────────────────────────────────────────
test.describe('Admin User Actions - Negative Scenarios', () => {
  test('Search with no match shows "No users found", and Clear search brings the list back', async ({ page }) => {
    await usersPage.search(`no-such-user-${Date.now()}`);
    await expect(usersPage.noUsersFound).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /^Actions for / })).toHaveCount(0);

    await usersPage.clearSearchButton.click();
    await expect(usersPage.searchBox).toHaveValue('');
    await expect(usersPage.noUsersFound).toBeHidden({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /^Actions for / }).first()).toBeVisible();
  });
});
