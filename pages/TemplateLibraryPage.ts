import { Page, Locator, expect } from '@playwright/test';

export class TemplateLibraryPage {
  readonly page:               Page;
  readonly heading:            Locator;
  readonly searchInput:        Locator;
  readonly uploadButton:       Locator;
  readonly backToDashboardBtn: Locator;
  readonly fileCards:          Locator;
  readonly inlineEditInput:    Locator;
  readonly createdCustomerTemplate: Locator;
  readonly customertemp1: Locator;
  readonly savechangebt: Locator;

  constructor(page: Page) {
    this.page               = page;
    this.heading            = page.getByRole('heading', { name: 'Template Library' });
    this.searchInput        = page.getByPlaceholder(/search/i);
    this.uploadButton       = page.getByRole('button', { name: 'Upload Letterhead' });
    this.backToDashboardBtn = page.getByRole('button', { name: 'Back to Dashboard' });
    this.fileCards          = page.locator('section').filter({ hasText: 'Letterheads' }).locator('[class*="aspect"]');
    this.inlineEditInput    = page.locator('input[maxlength="120"]');
    this.createdCustomerTemplate = page.getByRole('button', { name: 'Create Custom' });
    this.customertemp1 = page.getByRole('button', { name: 'Create Custom Template' });
    this.savechangebt = page.getByRole('button', { name: 'Save Preset Design' });

  }

  /** Open Template Library from dashboard via the user-avatar menu */
  async open(userInitial: string = 'S') {
    await this.page.getByRole('button', { name: userInitial, exact: true }).click();
    await this.page.getByRole('button', { name: 'Template Library' }).click();
  }

  /** Assert the page heading is visible and correct */
  async verifyPageLoaded() {
    await expect(this.heading).toBeVisible();
    await expect(this.heading).toHaveText('Template Library');
  }

  /** Navigate back to the dashboard */
  async backToDashboard() {
    await this.backToDashboardBtn.click();
  }

  /** Upload a file via the file-chooser dialog */
  // async uploadFile(filePath: string) {
    // const [fileChooser] = await Promise.all([
    //   this.page.waitForEvent('filechooser'),
    //   this.uploadButton.click(),
    // ]);
    // await fileChooser.setFiles(filePath);
  // }

  /** Click the created customer template button */
  async clickCreatedCustomerTemplate() {
    await this.createdCustomerTemplate.click();
  }
// custome button click
  async clickCustomTemplate1() {
    await this.customertemp1.click();
  }
  // customer template save button click
async ClickSaveChanges() {
  await this.savechangebt.click();
}
  /** Fill the search box */
  async search(term: string) {
    await this.searchInput.fill(term);
  }

  /** Clear the search box */
  async clearSearch() {
    await this.searchInput.clear();
  }

  /** Assert the first card containing partialText is visible */
  async verifyFileVisible(partialText: string) {
    await expect(this.page.getByText(partialText).first()).toBeVisible();
  }

  /** Return the current number of file cards in the Letterheads section */
  async getFileCount(): Promise<number> {
    return this.fileCards.count();
  }

  /** Assert no file cards are shown (empty search result) */
  async verifyNoResults() {
    await expect(this.fileCards).toHaveCount(0);
  }

  /** Assert no card containing partialText is present */
  async verifyFileNotVisible(partialText: string) {
    await expect(this.page.getByText(partialText)).toHaveCount(0);
  }

  /** Hover the first card and open inline edit WITHOUT saving (for cancel/empty tests) */
  async startInlineEdit() {
    await this.fileCards.first().hover();
    await this.page.getByRole('button', { name: /edit/i }).first().click();
  }

  /** Hover the first card → click the pencil icon → rename → press Enter */
  async editFirstResult(newName: string) {
    await this.fileCards.first().hover();
    await this.page.getByRole('button', { name: /edit/i }).first().click();
    await this.inlineEditInput.clear();
    await this.inlineEditInput.fill(newName);
    await this.inlineEditInput.press('Enter');
  }

  /** Hover the first card → click the trash icon → confirm the dialog */
  async deleteFirstResult() {
    await this.fileCards.first().hover();
    await this.page.getByRole('button', { name: /delete/i }).first().click();
    await this.page.getByRole('button', { name: /delete|confirm|yes/i }).last().click();
  }
}
