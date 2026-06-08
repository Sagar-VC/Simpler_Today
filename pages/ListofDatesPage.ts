import { Page, expect } from '@playwright/test';

export class ListofDatesPage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** Click the "List of Dates" tab in the workspace sidebar */
  async navigateToSection() {
    await this.page.locator('#actionable-act_2').click();
  }

  /** Click the "Add Event" button to open the Add Event form */
  async clickAddEvent() {
    await this.page.getByRole('button', { name: 'Add Event' }).click();
    await this.page.locator('div').filter({ hasText: /^Add Event$/ }).click();
  }

  /** Fill the event date */
  async fillDate(date: string) {
    await this.page.locator('input[type="date"]').fill(date);
  }

  /** Fill the event title */
  async fillEventTitle(title: string) {
    await this.page.getByRole('textbox', { name: 'e.g. FIR Filed' }).click();
    await this.page.getByRole('textbox', { name: 'e.g. FIR Filed' }).fill(title);
  }

  /** Fill the event description */
  async fillDescription(description: string) {
    await this.page.locator('textarea').click();
    await this.page.locator('textarea').fill(description);
  }

  /** Select a source document from the dropdown */
  async selectSourceDocument(label: string) {
    await this.page.getByRole('combobox').nth(1).click();
    await this.page.getByRole('combobox').nth(1).selectOption({ label });
  }

  /** Fill the page number field */
  async fillPageNumber(pageNumber: string) {
    await this.page.getByPlaceholder('e.g. 3').click();
    await this.page.getByPlaceholder('e.g. 3').fill(pageNumber);
  }

  /** Click the "Save Event" button to save the event */
  async saveEvent() {
    await this.page.getByRole('button', { name: 'Save Event' }).click();
  }

  /** Verify the saved event heading is visible in the list */
  async verifyEventVisible(title: string) {
    await expect(this.page.getByRole('heading', { name: title })).toBeVisible({ timeout: 15_000 });
  }
}
