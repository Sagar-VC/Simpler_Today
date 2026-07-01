import { Page, Locator, expect } from '@playwright/test';

export class CustomTemplatePage {
  private readonly page: Page;

  private readonly heading:                 Locator;
  private readonly searchInput:             Locator;
  private readonly backToDashboardBtn:      Locator;
  private readonly fileCards:               Locator;
  readonly inlineEditInput:                 Locator;
  private readonly createCustomBtn:          Locator;
  private readonly createCustomTemplateBtn:  Locator;
  private readonly savePresetBtn:            Locator;
  private readonly saveLetterheadBtn:        Locator;
  private readonly letterheadsTypeBtn:       Locator;
  private readonly supremeCourtTypeBtn:      Locator;
  private readonly highCourtsTypeBtn:        Locator;
  private readonly districtCourtsTypeBtn:    Locator;
  private readonly tribunalsTypeBtn:         Locator;

  constructor(page: Page) {
    this.page                    = page;
    this.heading                 = page.getByRole('heading', { name: 'Template Library' });
    this.searchInput             = page.getByPlaceholder('Search letterheads and court templates...');
    this.backToDashboardBtn      = page.getByRole('button', { name: 'Back to Dashboard' });
    this.fileCards               = page.locator('section')
                                       .filter({ hasText: 'Letterheads' })
                                       .locator('div')
                                       .filter({ has: page.getByRole('button', { name: 'Adjust Layout' }) });
    this.inlineEditInput         = page.locator('input[maxlength="120"]');
    this.createCustomBtn          = page.getByRole('button', { name: 'Create Custom' });
    this.createCustomTemplateBtn  = page.getByRole('button', { name: 'Create Custom Template' });
    this.savePresetBtn            = page.getByRole('button', { name: 'Save Preset Design' });
    this.saveLetterheadBtn        = page.getByRole('button', { name: 'Save Letterhead', exact: true });
    this.letterheadsTypeBtn       = page.getByRole('button', { name: 'Letterheads', exact: true });
    this.supremeCourtTypeBtn      = page.getByRole('button', { name: 'Supreme Court of India', exact: true });
    this.highCourtsTypeBtn        = page.getByRole('button', { name: 'High Courts of India', exact: true });
    this.districtCourtsTypeBtn    = page.getByRole('button', { name: 'District Courts of India', exact: true });
    this.tribunalsTypeBtn         = page.getByRole('button', { name: 'Tribunals & Forums', exact: true });
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  async open(userInitial: string = 'S') {
    await this.page.getByRole('button', { name: userInitial, exact: true }).click();
    await this.page.getByRole('button', { name: 'Template Library' }).click();
  }

  async backToDashboard() {
    await this.backToDashboardBtn.click();
  }

  // ── Create ──────────────────────────────────────────────────────────────────

  async clickCreateCustom() {
    await this.createCustomBtn.click();
  }

  async clickCreateCustomTemplate() {
    await this.createCustomTemplateBtn.click();
  }

  async selectLetterheads() {
    await this.letterheadsTypeBtn.click();
  }

  async selectSupremeCourtOfIndia() {
    await this.supremeCourtTypeBtn.click();
  }

  async selectHighCourtsOfIndia() {
    await this.highCourtsTypeBtn.click();
  }

  async selectDistrictCourtsOfIndia() {
    await this.districtCourtsTypeBtn.click();
  }

  async selectTribunalsAndForums() {
    await this.tribunalsTypeBtn.click();
  }

  async clickSaveChanges() {
    await this.savePresetBtn.waitFor({ state: 'visible', timeout: 60_000 });
    await this.savePresetBtn.click();
  }

  async saveLetterhead() {
    await this.saveLetterheadBtn.waitFor({ state: 'visible', timeout: 30_000 });
    await this.saveLetterheadBtn.click();
  }

  async selectHighCourtState(state: string = 'Delhi') {
    await this.page.getByRole('button', { name: state }).first().click();
  }

  // ── Search ──────────────────────────────────────────────────────────────────

  async search(term: string) {
    await this.searchInput.fill(term);
  }

  async clearSearch() {
    await this.searchInput.clear();
  }

  // ── Edit ────────────────────────────────────────────────────────────────────

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

  // ── Delete ──────────────────────────────────────────────────────────────────

  async deleteFirstResult() {
    await this.fileCards.first().hover();
    await this.page.getByRole('button', { name: /delete/i }).first().click();
    await this.page.getByRole('button', { name: /delete|confirm|yes/i }).last().click();
  }

  // ── Assertions ───────────────────────────────────────────────────────────────

  async verifyPageLoaded() {
    await expect(this.heading).toBeVisible();
    await expect(this.heading).toHaveText('Template Library');
  }

  async verifyFileVisible(partialText: string) {
    await expect(this.page.getByText(partialText).first()).toBeVisible();
  }

  async verifyFileNotVisible(partialText: string) {
    await expect(this.page.getByText(partialText)).toHaveCount(0);
  }

  async verifyNoResults() {
    await expect(this.fileCards).toHaveCount(0);
  }
}
