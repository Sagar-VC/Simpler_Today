import { Page, expect } from '@playwright/test';

export class WorkspacePage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** Type the workspace name in the dialog */
  async fillWorkspaceName(name: string) {
    await this.page.getByRole('textbox', { name: 'e.g., Petitioner vs' }).fill(name);
  }

  /** Select a role from the combobox inside the dialog */
  async selectRole(role: string) {
    await this.page.getByRole('dialog').getByRole('combobox').selectOption(role);
  }

  /** Expand the "Upload Files" section */
  async expandUploadSection() {
    await this.page.getByText('Upload Files (Documents/').click();
  }

  /**
   * Intercept the file chooser dialog and upload a file programmatically.
   * This prevents the native OS file dialog from blocking the test.
   */
  async uploadFile(filePath: string) {
    const [fileChooser] = await Promise.all([
      this.page.waitForEvent('filechooser'),
      this.page.locator('div').filter({ hasText: /^Click to upload$/ }).click(),
    ]);
    await fileChooser.setFiles(filePath);
  }

  /** Wait for the uploaded file name to appear in the UI */
  async waitForFileUploaded(fileName: string) {
    await this.page.waitForSelector(`text=${fileName}`, { timeout: 10000 });
  }

  /**
   * Click the "Create Workspace" submit button and confirm the dialog
   * actually closes. Failing fast here — instead of letting the caller
   * time out later waiting for "Back to Dashboard" — makes a stuck/rejected
   * submission (e.g. file still processing server-side) obvious immediately.
   */
  async clickCreateWorkspace() {
    const dialog = this.page.getByRole('dialog');
    await this.page.getByRole('button', { name: 'Create Workspace' }).click();
    try {
      await dialog.waitFor({ state: 'hidden', timeout: 30_000 });
    } catch {
      throw new Error(
        '"Create Workspace" dialog did not close after submitting — the workspace was likely not created (check for a validation error or slow file processing).'
      );
    }
  }

  /** Locator for the workspace name heading shown at the top of the workspace page */
  getWorkspaceName() {
    return this.page.getByRole('heading', { level: 1 });
  }

  /** Wait for the "Preparing your workspace" screen — non-blocking since it may flash briefly */
  async waitForPreparationScreen() {
    try {
      await expect(
        this.page.getByRole('heading', { name: 'Preparing your workspace' })
      ).toBeVisible({ timeout: 10000 });
    } catch {
      // The preparation screen sometimes skips or resolves too fast; continue to waitAndClickBackToDashboard
    }
  }

  /**
   * After workspace creation, navigate back to the dashboard.
   * Handles two confirmed app flows:
   *   (a) No file attached — no AI processing, so the app skips the prep
   *       screen entirely and drops the user straight into the workspace;
   *       use the sidebar "Back to workspace" link to reach the dashboard.
   *   (b) File attached — a "Preparing your workspace" screen is shown with
   *       a "Back to Dashboard" button.
   * Callers must not assume which branch ran — check the resulting URL
   * (see ListofDates.spec.ts / Supporting Material.spec.ts) rather than
   * asserting the dashboard unconditionally.
   */
  async waitAndClickBackToDashboard() {
    const backToDashboardBtn = this.page.getByRole('button', { name: 'Back to Dashboard' });
    const backToWorkspaceLink = this.page.getByText('Back to workspace', { exact: true });

    try {
      await backToDashboardBtn.waitFor({ timeout: 10000 });
      await backToDashboardBtn.click();
    } catch {
      await backToWorkspaceLink.waitFor({ timeout: 60000 });
      await backToWorkspaceLink.click();
    }
  }

  /** Dismiss the in-workspace tour overlay after creation (no-op if tour doesn't appear) */
  async skipTourInWorkspace() {
    try {
      const btn = this.page.getByRole('button', { name: 'Skip Tour' });
      await btn.waitFor({ state: 'visible', timeout: 5000 });
      await btn.click();
    } catch {
      // tour not shown for this session — continue
    }
  }

  /** Navigate back to the dashboard from inside a workspace */
  async backToWorkspaceList() {
    await this.page.getByText('Back to workspace').click();
  }

  /** Click the Edit option from the card context menu */
  async clickEditWorkspace() {
    await this.page.getByRole('button', { name: 'Edit' }).click();
  }

  /** Overwrite the workspace name and submit the edit form */
  async updateWorkspaceName(name: string) {
    await this.page.getByRole('textbox', { name: 'e.g., Petitioner vs' }).fill(name);
    await this.page.getByRole('button', { name: 'Update Workspace' }).click();
  }


  /** Close the edit dialog without saving */
  async cancelEditWorkspace() {
    await this.page.keyboard.press('Escape');
  }

  /** Assert the Update Workspace button is disabled */
  async verifyUpdateButtonDisabled() {
    await expect(
      this.page.getByRole('button', { name: 'Update Workspace' })
    ).toBeDisabled();
  }

  /** Click the Delete option from the card context menu */
  async clickDeleteWorkspace() {
    await this.page.getByRole('button', { name: 'Delete' }).click();
  }
    /** Confirm the deletion in the confirmation dialog */
  async confirmDelete() {
    await this.page.getByRole('button', { name: 'Confirm' }).click();
  }

}
