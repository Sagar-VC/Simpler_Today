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

  /** Assert the "+ Add Law Manually" button is displayed (after clickAdd() opens the dropdown) */
  async verifyAddLawManuallyButtonVisible() {
    await expect(
      this.page.getByRole('button', { name: '+ Add Law Manually' })
    ).toBeVisible({ timeout: 15_000 });
  }

  /** Select "Add Law Manually" from the dropdown that opens after clickAdd() */
  async clickAddLawManually() {
    await this.page.getByRole('button', { name: '+ Add Law Manually' }).click();
  }

  /** Assert the "Add Relevant Law" pop-up is displayed */
  async verifyAddLawPopupVisible() {
    const dialog = this.page.getByRole('dialog').filter({ hasText: 'Add Relevant Law' });
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.getByRole('heading', { name: 'Add Relevant Law' })).toBeVisible();
  }

  /** Tick a section checkbox inside the "Add Relevant Law" modal */
  async selectSection(labelText: string) {
    await this.page.locator('label').filter({ hasText: labelText }).click();
  }

  /**
   * Tick the first *selectable* section checkbox inside the "Add Relevant Law" modal
   * and return its section title. The section list is generated per workspace from
   * the processed documents, so it varies between runs — selecting by position
   * (rather than a hardcoded label) keeps the test workspace-agnostic.
   *
   * Sections already added to the workspace render with a disabled checkbox (an
   * "Already added" badge sits next to it, but that text lives in a sibling
   * element, so text-based filters on the checkbox itself can't detect it, and
   * `[role="checkbox"]`/`[disabled]` CSS attribute selectors don't match either
   * since the role/disabled state here is implicit, not a literal HTML attribute).
   * Iterating with Locator.isDisabled() — which correctly resolves both native and
   * ARIA disabled state — is what reliably finds the first selectable row.
   */
  async selectFirstSection(): Promise<string> {
    const dialog = this.page.getByRole('dialog').filter({ hasText: 'Add Relevant Law' });
    const checkboxes = dialog.getByRole('checkbox');
    await checkboxes.first().waitFor({ state: 'visible', timeout: 15_000 });

    const count = await checkboxes.count();
    let availableCheckbox = null;
    for (let i = 0; i < count; i++) {
      const candidate = checkboxes.nth(i);
      if (!(await candidate.isDisabled())) {
        availableCheckbox = candidate;
        break;
      }
    }
    if (!availableCheckbox) {
      throw new Error('No selectable (non-disabled) law section found in the Add Relevant Law modal');
    }

    // The checkbox itself is a native input with no text/aria-label — its title,
    // section number, and act name live in a sibling element under the same row.
    // Row text reads "<Title>Section - N Act - <Act name>" — keep just the title.
    const rowText = await availableCheckbox.evaluate((el) => el.parentElement?.textContent ?? '');
    const title = rowText.split(/Section\s*-\s*\d+/)[0].trim();

    await availableCheckbox.check();
    return title;
  }

  /** Fill the "Description" field inside the "Add Relevant Law" modal */
  async fillDescription(text: string) {
    const dialog = this.page.getByRole('dialog').filter({ hasText: 'Add Relevant Law' });
    await dialog.getByPlaceholder('Add notes or leave blank to use section title from the list').fill(text);
  }

  /** Submit the modal to save the selected law sections */
  async clickAddLaw() {
    await this.page.getByRole('button', { name: 'Add Law', exact: true }).click();
  }

  /**
   * Click the delete (trash) icon on the law row matching the given section text.
   *
   * Each row is a `div.cursor-pointer` card holding exactly one icon-only button
   * (the trash icon has no accessible name). Scoping the button lookup to the row
   * that contains the target text avoids matching unrelated icon-only buttons
   * elsewhere on the page (nav, header, chat input, etc.).
   */
  async clickRemoveLaw(sectionText: string) {
    const row = this.page.locator('div.cursor-pointer').filter({ hasText: sectionText });
    await row.first().locator('button').first().click();
  }

  /** Confirm the "Remove Law?" dialog */
  async confirmRemoveLaw() {
    await this.page.getByRole('button', { name: 'Remove' }).click();
  }

  /**
   * Verify the given text is visible in the laws list.
   *
   * Scrolls the matching row into view first so the check reflects what a user
   * would actually see on screen — the list can require scrolling, and this
   * flow never relies on a search/filter box, only the rendered text.
   */
  async verifyLawVisible(text: string) {
    const law = this.page.getByText(text).first();
    await law.scrollIntoViewIfNeeded();
    await expect(law).toBeVisible({ timeout: 15_000 });
  }

  /** Verify the given text is no longer visible in the laws list */
  async verifyLawRemoved(text: string) {
    await expect(
      this.page.getByText(text).first()
    ).toBeHidden({ timeout: 15_000 });
  }
}
