import { Page, expect } from '@playwright/test';

export class ApplicableLawsPage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** Click the "Applicable Laws" tab in the workspace sidebar */
  async navigateToSection() {
    await this.page.locator('#actionable-act_4').click();
  }

  /** Verify the Applicable Laws breadcrumb is active (section loaded) */
  async verifyPageLoaded() {
    await expect(
      this.page.locator('p').filter({ hasText: 'Applicable Laws' }).first()
    ).toBeVisible({ timeout: 15_000 });
  }

  /** Returns true when "Relevant Acts & Sections" panel is present */
  async hasRelevantActsSection(): Promise<boolean> {
    return this.page
      .getByText('Relevant Acts & Sections')
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
  }

  /**
   * Click the "+ Add" area in the "Relevant Acts & Sections" header.
   * Playwright captures this as a single element whose concatenated text
   * is "Relevant Acts & Sections+ Add".
   */
  async clickAdd() {
    await this.page.getByText('Relevant Acts & Sections+ Add').click();
  }

  /** Select "Add Law Manually" from the dropdown that opens after clickAdd() */
  async clickAddLawManually() {
    await this.page.getByRole('button', { name: '+ Add Law Manually' }).click();
  }

  /** Tick a section checkbox inside the "Add Relevant Law" modal */
  async selectSection(labelText: string) {
    await this.page.locator('label').filter({ hasText: labelText }).click();
  }

  /** Submit the modal to save the selected law sections */
  async clickAddLaw() {
    await this.page.getByRole('button', { name: 'Add Law', exact: true }).click();
  }

  /** Click the delete icon on the nth law row (0-based) */
  async clickRemoveLaw(index: number = 0) {
    await this.page.getByRole('button').filter({ hasText: /^$/ }).nth(3 + index).click();
  }

  /** Confirm the "Remove Law?" dialog */
  async confirmRemoveLaw() {
    await this.page.getByRole('button', { name: 'Remove' }).click();
  }

  /** Verify the given text is visible in the laws list */
  async verifyLawVisible(text: string) {
    await expect(
      this.page.getByText(text).first()
    ).toBeVisible({ timeout: 15_000 });
  }

  /** Verify the given text is no longer visible in the laws list */
  async verifyLawRemoved(text: string) {
    await expect(
      this.page.getByText(text).first()
    ).toBeHidden({ timeout: 15_000 });
  }
}
