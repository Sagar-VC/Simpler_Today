import { Page, expect } from '@playwright/test';

export class SupportingMaterialPage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** Click "Supporting Material" in the workspace sidebar */
  async navigateToSection() {
    await this.page.getByText('Supporting Material').click();
  }

  /** Poll every 30 s until the processed file appears; throws after maxAttempts */
  async waitForFileReady(fileName: string, maxAttempts = 40) {
    const fileLocator = this.page.getByText(fileName).first();
    for (let i = 0; i < maxAttempts; i++) {
      await this.page.mouse.move(400, 300);
      if (await fileLocator.isVisible().catch(() => false)) return;
      if (i < maxAttempts - 1) await this.page.waitForTimeout(30_000);
    }
    throw new Error(`File "${fileName}" was not ready after ${(maxAttempts * 30) / 60} minutes`);
  }

  /** Click the file entry in the Supporting Material list */
  async clickFile(fileName: string) {
    await this.page.getByText(fileName).first().click();
  }

  /** Assert the Supporting Material section is loaded */
  async verifyPageLoaded() {
    await expect(this.page.getByText('Supporting Material').first()).toBeVisible({ timeout: 30_000 });
  }

  /** Hover over the file row to reveal the action icons */
  async hoverFile(fileName: string) {
    await this.page.getByText(fileName).first().hover({ timeout: 30_000 });
  }

  /** Click the first (view/insights) icon in the revealed action group */
  async clickViewIcon() {
    await this.page.locator('div[class*="group-hover:opacity-100"] button').first().click({ timeout: 30_000 });
  }

  /** Verify the Document Insights popup title is visible */
  async verifyDocumentInsightsTitle() {
    await expect(this.page.getByText('Document Insights').first()).toBeVisible({ timeout: 30_000 });
  }

  /** Verify the file name is shown inside the Document Insights popup */
  async verifyFileNameInPopup(fileName: string) {
    await expect(this.page.getByText(fileName).first()).toBeVisible({ timeout: 30_000 });
  }

  /** Verify the Summary label is visible inside the popup */
  async verifySummaryLabel() {
    await expect(this.page.locator("//label[normalize-space()='Summary']").first()).toBeVisible({ timeout: 30_000 });
  }

  /** Scroll to and verify the AI-generated summary paragraph is rendered */
  async verifySummaryContent() {
    await this.page.locator('p[class*="whitespace-pre-wrap"]').first().scrollIntoViewIfNeeded();
    await expect(this.page.locator('p[class*="whitespace-pre-wrap"]').first()).toBeVisible({ timeout: 30_000 });
  }

  /** Close the Document Insights popup */
  async closeInsightsPopup() {
    await this.page.getByRole('button', { name: 'Close' }).click();
  }

  /** Click the "Open Document" button to launch the document viewer */
  async openDocument() {
    await this.page.locator("button[title='Open Document']").click({ timeout: 30_000 });
  }

  /** Verify the file name is shown in the document viewer header */
  async verifyDocumentViewerFileName(fileName: string) {
    await expect(this.page.getByText(fileName).first()).toBeVisible({ timeout: 30_000 });
  }

  /** Close the document viewer */
  async closeDocumentViewer() {
    await this.page.locator("button[title='Close']").click({ timeout: 30_000 });
  }

  /** Type into the search box and wait for results to settle */
  async searchFile(searchText: string) {
    await this.page.locator("input[placeholder='Search documents...']").click({ timeout: 30_000 });
    await this.page.locator("input[placeholder='Search documents...']").fill(searchText);
    await this.page.waitForTimeout(500);
  }

  /** Verify the given file name appears in the search results */
  async verifySearchResult(fileName: string) {
    await expect(this.page.getByText(fileName).first()).toBeVisible({ timeout: 30_000 });
  }
}
