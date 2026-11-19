import { Page, Locator, expect } from '@playwright/test';

/** The "Document Drafts" section of the Template Library: uploaded draft templates. */
export class DocumentDraftsPage {
  private readonly page: Page;

  private readonly heading:        Locator;
  private readonly uploadDraftBtn: Locator;
  private readonly previewTitle:   Locator;
  private readonly previewFrame:   Locator;
  private readonly closeBtn:       Locator;

  constructor(page: Page) {
    this.page           = page;
    this.heading        = page.getByRole('heading', { name: 'Template Library' });
    this.uploadDraftBtn = page.getByRole('button', { name: /upload.*draft/i });
    this.previewTitle   = page.getByText('Previewing Document Draft');
    this.previewFrame   = page.locator('iframe');
    this.closeBtn       = page.getByRole('button', { name: 'Close' });
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  /** Open the Template Library from the avatar menu (the avatar shows 1–2 initials). */
  async open() {
    await this.page.getByRole('button', { name: /^[A-Za-z]{1,2}$/ }).click();
    await this.page.getByRole('button', { name: 'Template Library' }).click();
    await expect(this.heading).toBeVisible({ timeout: 20_000 });
  }

  // ── Cards ───────────────────────────────────────────────────────────────────

  /** A draft's card in the Document Drafts grid, by its displayed name. */
  card(name: string): Locator {
    return this.page.locator('section')
      .filter({ hasText: 'Document Drafts' })
      .locator('.grid > div')
      .filter({ has: this.page.locator(`p[title="${name}"]`) })
      .first();
  }

  /** Hover a draft's card to reveal its actions, then click one of them. */
  private async clickCardAction(name: string, action: string) {
    const card = this.card(name);
    await card.scrollIntoViewIfNeeded();
    await card.hover();
    await card.getByRole('button', { name: action }).click();
  }

  /** Upload a draft through "Upload Document Draft"; its card shows the name without the extension. */
  async upload(file: { name: string; mimeType: string; buffer: Buffer }) {
    const [fileChooser] = await Promise.all([
      this.page.waitForEvent('filechooser'),
      this.uploadDraftBtn.click(),
    ]);
    await fileChooser.setFiles(file);
    await expect(this.card(file.name.replace(/\.[^.]+$/, ''))).toBeVisible({ timeout: 30_000 });
  }

  /** Delete a draft and wait for its card to disappear. */
  async delete(name: string) {
    await this.clickCardAction(name, 'Delete template');
    await this.page.getByRole('button', { name: /delete|confirm|yes/i }).last().click();
    await expect(this.card(name)).toBeHidden({ timeout: 10_000 });
  }

  // ── Preview ─────────────────────────────────────────────────────────────────

  async preview(name: string) {
    await this.clickCardAction(name, 'Preview');
  }

  async verifyPreviewOpen(name: string) {
    await expect(this.page.getByRole('heading', { name, level: 3, exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(this.previewTitle).toBeVisible();
    await expect(this.previewFrame).toBeVisible();
  }

  async closePreview() {
    await this.closeBtn.click();
    await expect(this.previewTitle).toBeHidden();
  }
}
