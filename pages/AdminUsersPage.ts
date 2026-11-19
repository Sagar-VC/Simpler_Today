import { Page, Locator, expect } from '@playwright/test';

/** Admin console - Users page: the user list, the "Create user" dialog and a user's details. */
export class AdminUsersPage {
  private readonly page: Page;

  readonly usersLink:     Locator;
  readonly heading:       Locator;
  readonly addUserButton: Locator;
  readonly searchBox:     Locator;

  // ── List: tabs, status filter, sorting, empty state
  readonly activeTab:         Locator;
  readonly deletedTab:        Locator;
  readonly statusFilter:      Locator;
  readonly sortByNameButton:  Locator;
  readonly nameColumnHeader:  Locator;
  readonly clearSearchButton: Locator;
  readonly noUsersFound:      Locator;

  // ── "Create user" dialog
  readonly createDialog:     Locator;
  readonly nameField:        Locator;
  readonly emailField:       Locator;
  readonly createUserButton: Locator;
  readonly cancelButton:     Locator;
  readonly userCreated:      Locator;

  // ── "Edit user" dialog (opened from a user's details)
  readonly editDialog:        Locator;
  readonly editNameField:     Locator;
  readonly editEmailField:    Locator;
  readonly saveChangesButton: Locator;
  readonly editCancelButton:  Locator;
  readonly userUpdated:       Locator;

  constructor(page: Page) {
    this.page = page;

    this.usersLink     = page.getByRole('link', { name: 'Users' });
    this.heading       = page.getByRole('heading', { name: 'Users' });
    this.addUserButton = page.getByRole('button', { name: 'Add user' });
    this.searchBox     = page.getByRole('searchbox', { name: /Search by name, email or user/ });

    this.activeTab         = page.getByRole('link', { name: 'Active', exact: true });
    this.deletedTab        = page.getByRole('link', { name: 'Deleted', exact: true });
    this.statusFilter      = page.getByRole('combobox', { name: 'Status filter' });
    this.sortByNameButton  = page.getByRole('button', { name: 'Sort by Name' });
    this.nameColumnHeader  = page.getByRole('columnheader').filter({ has: this.sortByNameButton });
    this.clearSearchButton = page.getByRole('button', { name: 'Clear search' });
    this.noUsersFound      = page.getByText('No users found');

    this.createDialog    = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Create user' }) });
    this.nameField        = this.createDialog.getByRole('textbox', { name: 'Full name' });
    this.emailField       = this.createDialog.getByRole('textbox', { name: 'Email address' });
    this.createUserButton = this.createDialog.getByRole('button', { name: 'Create user' });
    this.cancelButton     = this.createDialog.getByRole('button', { name: 'Cancel' });
    this.userCreated      = page.getByText('User created');

    this.editDialog        = page.getByRole('dialog', { name: 'Edit user' });
    // The "Full name" and "Email address" labels aren't linked to their inputs;
    // the email can't be changed, so its input is the disabled one.
    this.editNameField     = this.editDialog.locator('input:not([disabled])');
    this.editEmailField    = this.editDialog.locator('input[disabled]');
    this.saveChangesButton = this.editDialog.getByRole('button', { name: 'Save changes' });
    this.editCancelButton  = this.editDialog.getByRole('button', { name: 'Cancel' });
    // Toast title after "Save changes" (was "User updated" in older console builds);
    // its description reads "This user is now shown as <new name>."
    this.userUpdated       = page.getByText('Name updated', { exact: true });
  }

  /** Open the Users page from the side navigation */
  async open() {
    await this.usersLink.click();
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }

  /** Validation message inside the "Create user" dialog */
  dialogError(message: string): Locator {
    return this.createDialog.getByText(message);
  }

  /** Open "Add user", fill the form and submit it */
  async createUser(name: string, email: string) {
    await this.addUserButton.click();
    await this.nameField.fill(name);
    await this.emailField.fill(email);
    await this.createUserButton.click();
  }

  /** Search the user list */
  async search(text: string) {
    await this.searchBox.fill(text);
    await this.searchBox.press('Enter');
  }

  /** The list row for a user, found by their email (on the Active and the Deleted tab) */
  row(email: string): Locator {
    return this.page.getByRole('row').filter({ hasText: email });
  }

  /** The Status cell of a user's row, when it shows the given status (Active / Suspended) */
  statusCell(email: string, status: string): Locator {
    return this.row(email).getByRole('cell', { name: status, exact: true });
  }

  /** Names of the users listed on this page, in row order (read from each row's Actions button) */
  async listedNames(): Promise<string[]> {
    const labels = await this.page.getByRole('button', { name: /^Actions for / }).evaluateAll(
      buttons => buttons.map(b => b.getAttribute('aria-label') ?? ''));
    return labels.map(label => label.replace(/^Actions for /, ''));
  }

  /** Pick a status in the Status filter */
  async filterByStatus(status: 'All statuses' | 'Active' | 'Suspended') {
    await this.statusFilter.click();
    await this.page.getByRole('option', { name: status, exact: true }).click();
  }

  /** Open a row's Actions menu and pick an item */
  async rowAction(name: string, item: string) {
    await this.page.getByRole('button', { name: `Actions for ${name}` }).click();
    // exact: "Activate" is also part of "Deactivate"
    await this.page.getByRole('menuitem', { name: item, exact: true }).click();
  }

  /** A confirmation dialog, found by its title (e.g. "Deactivate this user?") */
  confirmDialog(title: string): Locator {
    return this.page.getByRole('dialog', { name: title });
  }

  /** The details panel for a user, labelled with their name */
  detailsPanel(name: string): Locator {
    return this.page.getByLabel(name, { exact: true });
  }

  /** Open a user's details by clicking their name in the list */
  async openDetails(email: string) {
    await this.row(email).getByRole('cell').first().click();
  }

  /** Click Edit in the open details panel of a user (the panel is replaced by the "Edit user" dialog) */
  async openEdit(name: string) {
    await this.detailsPanel(name).getByRole('button', { name: 'Edit' }).click();
    await expect(this.editDialog).toBeVisible();
  }

  /** Close the open details panel */
  async closeDetails() {
    // exact: the "User created" toast has its own "Close toast" button
    await this.page.getByRole('button', { name: 'Close', exact: true }).click();
  }

  /** Delete a user from their row's Actions menu and confirm */
  async deleteUser(name: string) {
    await this.rowAction(name, 'Delete');
    await this.confirmDialog('Delete this user?').getByRole('button', { name: 'Delete', exact: true }).click();
  }

  /**
   * Delete a test user a failed run left behind, if they are still in the list.
   * Found by the timestamp in their qa.user.<timestamp>@example.com email, which is in their name too.
   */
  async deleteUserIfPresent(email: string) {
    await this.page.goto(new URL('/users', process.env.ADMIN_URL).href);
    await this.search(email.split('@')[0].replace('qa.user.', ''));
    const actions = this.row(email).getByRole('button', { name: /^Actions for / });
    // waitFor, not isVisible: isVisible returns at once and would miss a row that is still loading
    if (!(await actions.waitFor({ timeout: 10_000 }).then(() => true, () => false))) return;
    const name = ((await actions.getAttribute('aria-label')) ?? '').replace(/^Actions for /, '');
    await this.deleteUser(name);
  }
}
