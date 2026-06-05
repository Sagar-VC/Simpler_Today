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

  /** Click the "Create Workspace" submit button */
  async clickCreateWorkspace() {
    await this.page.getByRole('button', { name: 'Create Workspace' }).click();
  }

  /** Assert the "Preparing your workspace" loading screen is visible */
  async waitForPreparationScreen() {
    await expect(
      this.page.getByRole('heading', { name: 'Preparing your workspace' })
    ).toBeVisible({ timeout: 15000 });
  }

  /**
   * Wait for workspace preparation to complete (indicated by the
   * "Back to Dashboard" button appearing), then click it.
   */
  async waitAndClickBackToDashboard() {
    await this.page.getByRole('button', { name: 'Back to Dashboard' }).waitFor({ timeout: 60000 });
    await this.page.getByRole('button', { name: 'Back to Dashboard' }).click();
  }

  /** Dismiss the in-workspace tour overlay after creation */
  async skipTourInWorkspace() {
    await this.page.getByRole('button', { name: 'Skip Tour' }).click();
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
