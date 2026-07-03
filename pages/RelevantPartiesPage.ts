import { Page, Locator, expect } from '@playwright/test';

export class RelevantPartiesPage {
  private readonly page: Page;

  private readonly partiesTab:         Locator;
  private readonly addPartyBtn:        Locator;
  private readonly addPartyDialog:     Locator;
  private readonly fullNameInput:      Locator;
  private readonly roleSelect:         Locator;
  private readonly detailsTextarea:    Locator;
  private readonly contactNumberInput: Locator;
  private readonly emailInput:         Locator;
  private readonly officialIdFileInput: Locator;
  private readonly savePartyBtn:       Locator;

  constructor(page: Page) {
    this.page = page;

    this.partiesTab         = page.locator('#actionable-act_7');
    this.addPartyBtn         = page.getByRole('button', { name: '+ Add Party' });
    this.addPartyDialog      = page.getByRole('dialog').filter({ hasText: 'Add Party' });
    // Dialog field order: Full Name (input), Role (select), Details/Notes (textarea),
    // Contact Number (input), Email ID (input[type=email]), Official ID (hidden file input).
    this.fullNameInput       = this.addPartyDialog.locator('input').first();
    this.roleSelect          = this.addPartyDialog.locator('select');
    this.detailsTextarea     = this.addPartyDialog.locator('textarea');
    this.contactNumberInput  = this.addPartyDialog.locator('input').nth(1);
    this.emailInput          = this.addPartyDialog.locator('input[type="email"]');
    this.officialIdFileInput = this.addPartyDialog.locator('input[type="file"]');
    this.savePartyBtn        = this.addPartyDialog.getByRole('button', { name: 'Save Party' });
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  /** Click the "Relevant Parties" tab in the workspace sidebar */
  async navigateToSection() {
    await this.partiesTab.click();
  }

  /** Wait for the AI party-extraction job to finish (panel shows "Under Processing" until then) */
  async waitForPartiesReady() {
    await expect(this.page.getByRole('heading', { name: 'Under Processing' })).toBeHidden({ timeout: 240_000 });
  }

  // ── Add Party ───────────────────────────────────────────────────────────────

  /** Assert the "+ Add Party" button is visible */
  async verifyAddPartyButtonVisible() {
    await expect(this.addPartyBtn).toBeVisible({ timeout: 15_000 });
  }

  /** Click the "+ Add Party" button to open the Add Party form */
  async clickAddParty() {
    await this.addPartyBtn.click();
  }

  /** Assert the Add Party form/dialog is displayed */
  async verifyAddPartyFormVisible() {
    await expect(this.addPartyDialog).toBeVisible({ timeout: 10_000 });
    await expect(this.addPartyDialog.getByRole('heading', { name: 'Add Party' })).toBeVisible();
  }

  /** Assert the required fields (Full Name, Details/Notes) are present in the form */
  async verifyRequiredFieldsPresent() {
    await expect(this.addPartyDialog.getByText('Full Name', { exact: false })).toBeVisible();
    await expect(this.fullNameInput).toBeVisible();
    await expect(this.addPartyDialog.getByText('Details/Notes', { exact: false })).toBeVisible();
    await expect(this.detailsTextarea).toBeVisible();
  }

  /** Fill the Add Party form. `role`, `contact`, `email`, `officialIdFilePath` are optional fields. */
  async fillPartyForm(details: {
    name: string;
    role?: 'Petitioner' | 'Respondent' | 'Accused' | 'Victim' | 'Witness' | 'Other';
    details: string;
    contact?: string;
    email?: string;
    officialIdFilePath?: string;
  }) {
    await this.fullNameInput.fill(details.name);
    if (details.role) {
      await this.roleSelect.selectOption(details.role);
    }
    await this.detailsTextarea.fill(details.details);
    if (details.contact) {
      await this.contactNumberInput.fill(details.contact);
    }
    if (details.email) {
      await this.emailInput.fill(details.email);
    }
    if (details.officialIdFilePath) {
      await this.uploadOfficialId(details.officialIdFilePath);
    }
  }

  /** Upload a file for the "Official ID" field via its hidden file input */
  async uploadOfficialId(filePath: string) {
    await this.officialIdFileInput.setInputFiles(filePath);
  }

  /** Assert the Official ID file was accepted by the form */
  async verifyOfficialIdUploaded() {
    await expect(this.addPartyDialog.getByText('ID Uploaded')).toBeVisible({ timeout: 10_000 });
  }

  /** Click "Save Party" to submit the form */
  async clickSaveParty() {
    await this.savePartyBtn.click();
  }

  // ── Assertions ──────────────────────────────────────────────────────────────

  /** Locate the party card by its name, scoping later assertions to that card only */
  private getPartyCard(name: string): Locator {
    return this.page.locator('div.bg-white.p-4.rounded-xl.border').filter({ hasText: name });
  }

  /** Assert the given party name appears in the Relevant Parties list */
  async verifyPartyVisible(name: string) {
    await expect(this.getPartyCard(name)).toBeVisible({ timeout: 15_000 });
  }

  /** Assert the party card shows the given contact number and/or email */
  async verifyPartyDetails(name: string, details: { contact?: string; email?: string }) {
    const card = this.getPartyCard(name);
    await expect(card).toBeVisible({ timeout: 15_000 });
    if (details.contact) {
      await expect(card.getByText(details.contact)).toBeVisible();
    }
    if (details.email) {
      await expect(card.getByText(details.email)).toBeVisible();
    }
  }
}
