import { Page, Locator, expect } from '@playwright/test';

/** Admin console - Templates: the global template library, the "Create a template" dialog and a template's page. */
export class AdminTemplatesPage {
  private readonly page: Page;

  readonly templatesLink:      Locator;
  readonly heading:            Locator;
  readonly createCustomButton: Locator;
  readonly uploadDraftButton:  Locator;
  readonly searchBox:          Locator;
  readonly statusFilter:       Locator;
  readonly categoryFilter:     Locator;
  readonly table:              Locator;
  readonly noMatches:          Locator;

  // ── Upload Document Draft (toasts)
  readonly hiddenFromLawyers: Locator;
  readonly uploadRefused:     Locator;

  // ── "Create a template" dialog
  readonly createDialog:               Locator;
  readonly createCustomTemplateButton: Locator;
  readonly templateNameField:          Locator;
  readonly savePresetButton:           Locator;
  readonly backToSelectionButton:      Locator;
  readonly createCancelButton:         Locator;
  readonly templateAdded:              Locator;

  // ── A template's page
  readonly backToListLink:    Locator;
  readonly detailsHeading:    Locator;
  readonly editDetailsButton: Locator;
  readonly deleteButton:      Locator;
  readonly publishButton:     Locator;
  readonly versionsTab:       Locator;
  readonly previewFrame:      Locator;
  readonly profiling:         Locator;
  readonly reProfileButton:   Locator;
  readonly formattingTab:     Locator;
  readonly notPublishedYet:   Locator;
  readonly noLongerExists:    Locator;

  // ── Formatting tab: "AI Drafting Blueprint & Variables" of an uploaded draft
  readonly blueprintHeading:     Locator;
  readonly blueprintSettings:    Locator;
  readonly registryHeading:      Locator;
  readonly registeredCount:      Locator;
  readonly registeredFields:     Locator;
  readonly customFieldInput:     Locator;
  readonly addFieldButton:       Locator;
  readonly suggestedFields:      Locator;
  readonly saveFormattingButton: Locator;
  readonly formattingSaved:      Locator;

  // ── "Edit details" dialog
  readonly editDialog:        Locator;
  readonly editNameField:     Locator;
  readonly editCategoryField: Locator;
  readonly categoryOptions:   Locator;
  readonly nameRequired:      Locator;
  readonly saveDetailsButton: Locator;
  readonly editCancelButton:  Locator;
  readonly editCloseButton:   Locator;
  readonly templateRenamed:   Locator;
  readonly categoryChanged:   Locator;

  // ── "Delete this template?" dialog
  readonly deleteDialog:    Locator;
  readonly templateDeleted: Locator;

  constructor(page: Page) {
    this.page = page;

    this.templatesLink      = page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Templates' });
    this.heading            = page.getByRole('heading', { name: 'Templates', level: 1 });
    // exact: the dialog has a "Create Custom Template" button too
    this.createCustomButton = page.getByRole('button', { name: 'Create Custom', exact: true });
    this.uploadDraftButton  = page.getByRole('button', { name: 'Upload Document Draft' });
    this.searchBox          = page.getByRole('searchbox', { name: 'Search by name…' });
    this.statusFilter       = page.getByRole('group', { name: 'Status' });
    this.categoryFilter     = page.getByRole('group', { name: 'Category' });
    this.table              = page.getByRole('table', { name: 'Global templates' });
    this.noMatches          = page.getByText('Nothing matches those filters');

    this.hiddenFromLawyers = page.getByText('Drafts stay hidden from lawyers until you publish them.');
    this.uploadRefused     = page.getByText(/Couldn.t add 1 file/);

    this.createDialog               = page.getByRole('dialog', { name: 'Create a template' });
    this.createCustomTemplateButton = this.createDialog.getByRole('button', { name: 'Create Custom Template' });
    this.templateNameField          = this.createDialog.getByRole('textbox', { name: 'Template Name' });
    this.savePresetButton           = this.createDialog.getByRole('button', { name: 'Save Preset Design' });
    this.backToSelectionButton      = this.createDialog.getByRole('button', { name: 'Back to Selection' });
    this.createCancelButton         = this.createDialog.getByRole('button', { name: 'Cancel' });
    this.templateAdded              = page.getByText('Template added');

    // On a template's page, the "Templates" breadcrumb link (the side navigation has one too)
    this.backToListLink    = page.getByRole('main').getByRole('link', { name: 'Templates' });
    this.detailsHeading    = page.getByRole('main').getByRole('heading', { level: 1 });
    this.editDetailsButton = page.getByRole('button', { name: 'Edit details' });
    this.deleteButton      = page.getByRole('main').getByRole('button', { name: 'Delete', exact: true });
    this.publishButton     = page.getByRole('main').getByRole('button', { name: 'Publish', exact: true });
    this.versionsTab       = page.getByRole('tab', { name: 'Versions' });
    // An uploaded file's preview, on the Content tab
    this.previewFrame      = page.getByRole('tabpanel', { name: 'Content' }).locator('iframe');
    // Shown while the AI analyses an uploaded file (its profile)
    this.profiling         = page.getByRole('main').getByText('Profiling…');
    this.reProfileButton   = page.getByRole('main').getByRole('button', { name: 'Re-profile' });
    this.formattingTab     = page.getByRole('tab', { name: 'Formatting' });
    this.notPublishedYet   = page.getByText('Not published yet');
    this.noLongerExists    = page.getByText('That template no longer exists');

    const formatting = page.getByRole('tabpanel', { name: 'Formatting' });
    this.blueprintHeading     = formatting.getByRole('heading', { name: 'AI Drafting Blueprint & Variables' });
    this.blueprintSettings    = formatting.getByRole('combobox');  // tone, structure, draft depth
    this.registryHeading      = formatting.getByRole('heading', { name: 'Interactive Variables Registry' });
    this.registeredCount      = formatting.getByText(/^\d+ registered$/);
    this.registeredFields     = formatting.getByRole('region', { name: 'Registered fields' }).getByRole('listitem');
    this.customFieldInput     = formatting.getByRole('textbox', { name: 'Add Custom Field' });
    this.addFieldButton       = formatting.getByRole('button', { name: 'Add', exact: true });
    this.suggestedFields      = formatting.getByRole('group', { name: 'AI Suggested Fields' }).getByRole('button');
    this.saveFormattingButton = formatting.getByRole('button', { name: 'Approve & Save Configuration' });
    // Toast after "Approve & Save Configuration" (was "Formatting saved" in older console builds)
    this.formattingSaved      = page.getByText('Template fields saved', { exact: true });

    this.editDialog        = page.getByRole('dialog', { name: 'Edit details' });
    this.editNameField     = this.editDialog.getByRole('textbox', { name: 'Name' });
    this.editCategoryField = this.editDialog.getByRole('combobox', { name: 'Category' });
    // The category list opens outside the dialog
    this.categoryOptions   = page.getByRole('listbox').getByRole('option');
    this.nameRequired      = this.editDialog.getByText('Enter a name for the template.');
    this.saveDetailsButton = this.editDialog.getByRole('button', { name: 'Save details' });
    this.editCancelButton  = this.editDialog.getByRole('button', { name: 'Cancel' });
    this.editCloseButton   = this.editDialog.getByRole('button', { name: 'Close' });
    // Toasts after "Save details" (both replaced the older single "Details saved" toast)
    this.templateRenamed   = page.getByText('Template renamed', { exact: true });
    this.categoryChanged   = page.getByText('Category changed', { exact: true });

    this.deleteDialog    = page.getByRole('dialog', { name: 'Delete this template?' });
    this.templateDeleted = page.getByText('Template deleted.');
  }

  /** Open the Templates page from the side navigation */
  async open() {
    await this.templatesLink.click();
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }

  /** Search the template list by name */
  async search(text: string) {
    await this.searchBox.fill(text);
  }

  /** Pick a Status filter button (All / Draft / Published / Retired) */
  async filterByStatus(status: 'All' | 'Draft' | 'Published' | 'Retired') {
    const button = this.statusFilter.getByRole('button', { name: status, exact: true });
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
  }

  /** Pick a Category filter button (e.g. Letterhead, Document Draft, Custom) */
  async filterByCategory(category: string) {
    const button = this.categoryFilter.getByRole('button', { name: category, exact: true });
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
  }

  /** The list row for a template, found by its name */
  row(name: string): Locator {
    return this.table.getByRole('row').filter({ hasText: name });
  }

  /** The values of one column (e.g. "Status") for the templates listed on this page */
  async columnValues(column: string): Promise<string[]> {
    const headers = await this.table.getByRole('columnheader').allInnerTexts();
    const index   = headers.findIndex(h => h.trim().toLowerCase() === column.toLowerCase());
    return this.table.getByRole('row').evaluateAll((rows, i) => rows.slice(1)
      .map(r => r.querySelectorAll('td'))
      .filter(cells => cells.length > 1)  // skip the one-cell "Nothing matches" row
      .map(cells => cells[i]?.textContent?.trim() ?? ''), index);
  }

  /** The status shown on a template's page (Draft / Published / Retired) */
  detailsStatus(status: string): Locator {
    return this.page.getByRole('main').getByText(status, { exact: true });
  }

  /** The category shown under a template's name on its page (e.g. Custom, High Court) */
  detailsCategory(category: string): Locator {
    return this.page.getByRole('main').getByRole('paragraph').filter({ hasText: new RegExp(`^${category}$`) });
  }

  /** An option in the open category list of "Edit details" */
  categoryOption(category: string): Locator {
    return this.categoryOptions.filter({ hasText: new RegExp(`^${category}$`) });
  }

  /** Upload files through "Upload Document Draft" (Playwright answers the file picker); each becomes a draft */
  async uploadDocumentDraft(files: { name: string; mimeType: string; buffer: Buffer }[]) {
    const chooserPromise = this.page.waitForEvent('filechooser');
    await this.uploadDraftButton.click();
    await (await chooserPromise).setFiles(files);
  }

  /** The refusal message for a file type the upload doesn't take */
  unsupportedFile(fileName: string): Locator {
    return this.page.getByText(`${fileName}: Use a PDF, DOC, DOCX or TXT file.`);
  }

  /** The toast after uploading several files at once, e.g. "2 templates added" */
  templatesAdded(count: number): Locator {
    return this.page.getByText(`${count} templates added`);
  }

  /** A field in the Interactive Variables Registry, by its name */
  registeredField(name: string): Locator {
    return this.registeredFields.filter({ hasText: new RegExp(`^${name}$`) });
  }

  /** The Remove button of a registered field */
  removeFieldButton(name: string): Locator {
    return this.page.getByRole('tabpanel', { name: 'Formatting' }).getByRole('button', { name: `Remove ${name}` });
  }

  /** Formatting tab: type a custom field name and click Add (it is only kept after Approve & Save) */
  async addCustomField(name: string) {
    await this.customFieldInput.fill(name);
    await this.addFieldButton.click();
  }

  /** Create Custom → Create Custom Template, name it and save it (it is saved as a draft) */
  async createCustomTemplate(name: string) {
    await this.createCustomButton.click();
    await this.createCustomTemplateButton.click();
    await this.templateNameField.fill(name);
    await this.savePresetButton.click();
  }

  /** Open a template's page by clicking its name in the list */
  async openTemplate(name: string) {
    await this.row(name).getByRole('cell').first().click();
    await expect(this.detailsHeading).toHaveText(name, { timeout: 15_000 });
  }

  /** On a template's page: Edit details → new name → Save details */
  async renameTemplate(newName: string) {
    await this.editDetailsButton.click();
    await this.editNameField.fill(newName);
    await this.saveDetailsButton.click();
  }

  /** On a template's page: Edit details → pick a category → Save details */
  async changeCategory(category: string) {
    await this.editDetailsButton.click();
    await this.editCategoryField.click();
    await this.categoryOption(category).click();
    await this.saveDetailsButton.click();
  }

  /** On a template's page: Delete and confirm (only drafts can be deleted) */
  async deleteTemplate() {
    await this.deleteButton.click();
    await this.deleteDialog.getByRole('button', { name: 'Delete', exact: true }).click();
  }

  /**
   * Delete a test template if it is still in the library, found by the timestamp in its
   * "QA Template <timestamp>" name. Only drafts have a Delete button, so a published template is never touched.
   * Deletes one template per call; returns whether it deleted one.
   */
  async deleteTemplateIfPresent(stamp: string): Promise<boolean> {
    await this.page.goto(new URL('/templates', process.env.ADMIN_URL).href);
    await this.search(stamp);
    const row = this.table.getByRole('row').filter({ hasText: new RegExp(`^QA Template (Renamed )?${stamp}`) }).first();
    // waitFor, not isVisible: isVisible returns at once and would miss a row that is still loading
    if (!(await row.waitFor({ timeout: 10_000 }).then(() => true, () => false))) return false;
    await row.getByRole('cell').first().click();
    await expect(this.detailsHeading).toContainText(stamp, { timeout: 15_000 });
    if (!(await this.deleteButton.waitFor({ timeout: 5_000 }).then(() => true, () => false))) return false;
    await this.deleteTemplate();
    // Wait for the delete to finish before the test closes the page
    await expect(this.templateDeleted).toBeVisible({ timeout: 15_000 });
    return true;
  }
}
