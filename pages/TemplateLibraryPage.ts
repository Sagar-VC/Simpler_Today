import { Page, Locator, expect } from '@playwright/test';

export class TemplateLibraryPage {
  private readonly page: Page;

  // ── Locators ──────────────────────────────────────────────────────────────
  private readonly heading:               Locator;
  private readonly searchInput:           Locator;
  private readonly backToDashboardBtn:    Locator;
  private readonly fileCards:             Locator;
  readonly inlineEditInput:               Locator;
  private readonly uploadBtn:              Locator;
  private readonly createCustomBtn:        Locator;
  private readonly createCustomTemplateBtn: Locator;
  private readonly savePresetBtn:          Locator;

  constructor(page: Page) {
    this.page                    = page;
    this.heading                 = page.getByRole('heading', { name: 'Template Library' });
    this.searchInput             = page.getByPlaceholder('Search letterheads and court templates...');
    this.backToDashboardBtn      = page.getByRole('button', { name: 'Back to Dashboard' });
    this.fileCards               = page.locator('section').filter({ hasText: 'Letterheads' }).locator('div').filter({ has: page.getByRole('button', { name: 'Adjust Layout' }) });
    this.inlineEditInput         = page.locator('input[maxlength="120"]');
    this.uploadBtn               = page.getByRole('button', { name: 'Upload Letterhead' });
    this.createCustomBtn         = page.getByRole('button', { name: 'Create Custom' });
    this.createCustomTemplateBtn = page.getByRole('button', { name: 'Create Custom Template' });
    this.savePresetBtn           = page.getByRole('button', { name: 'Save Preset Design' });
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  /** Open Template Library from the dashboard via the user-avatar menu */
  async open(userInitial: string = 'S') {
    await this.page.getByRole('button', { name: userInitial, exact: true }).click();
    await this.page.getByRole('button', { name: 'Template Library' }).click();
  }

  /** Navigate back to the dashboard */
  async backToDashboard() {
    await this.backToDashboardBtn.click();
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  /** Click "Upload Letterhead", intercept the file chooser and set the file */
  async uploadFile(filePath: string) {
    const [fileChooser] = await Promise.all([
      this.page.waitForEvent('filechooser'),
      this.uploadBtn.click(),
    ]);
    await fileChooser.setFiles(filePath);
  }

  /** Wait until the uploaded file name appears in the Letterheads section */
  async verifyFileUploaded(fileName: string) {
    await expect(
      this.fileCards.filter({ hasText: fileName }).first()
    ).toBeVisible({ timeout: 15000 });
  }

  /** Click the "Create Custom" button */
  async clickCreateCustom() {
    await this.createCustomBtn.click();
  }

  /** Click the "Create Custom Template" button */
  async clickCreateCustomTemplate() {
    await this.createCustomTemplateBtn.click();
  }

  /** Click the "Save Preset Design" button */
  async clickSaveChanges() {
    await this.savePresetBtn.click();
  }

  /** Fill the search box */
  async search(term: string) {
    await this.searchInput.fill(term);
  }

  /** Clear the search box */
  async clearSearch() {
    await this.searchInput.clear();
  }

  /** Hover the first card → click the pencil icon → rename → press Enter */
  async editFirstResult(newName: string) {
    await this.fileCards.first().hover();
    await this.page.getByRole('button', { name: /edit/i }).first().click();
    await this.inlineEditInput.clear();
    await this.inlineEditInput.fill(newName);
    await this.inlineEditInput.press('Enter');
  }

  /** Hover the first card and open inline edit without saving */
  async startInlineEdit() {
    await this.fileCards.first().hover();
    await this.page.getByRole('button', { name: /edit/i }).first().click();
  }

  /** Hover the first card → click the trash icon → confirm the dialog */
  async deleteFirstResult() {
    await this.fileCards.first().hover();
    await this.page.getByRole('button', { name: /delete/i }).first().click();
    await this.page.getByRole('button', { name: /delete|confirm|yes/i }).last().click();
  }

  // ── Assertions ────────────────────────────────────────────────────────────

  /** Assert the page heading is visible */
  async verifyPageLoaded() {
    await expect(this.heading).toBeVisible();
    await expect(this.heading).toHaveText('Template Library');
  }

  /** Assert the first card containing partialText is visible */
  async verifyFileVisible(partialText: string) {
    await expect(this.page.getByText(partialText).first()).toBeVisible();
  }

  /** Assert no card containing partialText is present */
  async verifyFileNotVisible(partialText: string) {
    await expect(this.page.getByText(partialText)).toHaveCount(0);
  }

  /** Assert no file cards are shown (empty search result) */
  async verifyNoResults() {
    await expect(this.fileCards).toHaveCount(0);
  }

  /** Return the current number of file cards in the Letterheads section */
  async getFileCount(): Promise<number> {
    return this.fileCards.count();
  }

  /** Assert the Letterheads section contains exactly the expected number of cards */
  async verifyFileCount(expected: number) {
    await expect(this.fileCards).toHaveCount(expected, { timeout: 10000 });
  }
}
