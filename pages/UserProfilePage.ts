import { Page, expect } from '@playwright/test';

export class UserProfilePage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** Click the avatar button (by initial letter) then open User Profile */
  async openProfile(initial: string) {
    await this.page.getByRole('button', { name: initial, exact: true }).click();
    await this.page.getByRole('button', { name: 'User Profile' }).click();
  }

  /** Update the full name field; clicks the heading to trigger the blur/update event */
  async updateFullName(name: string) {
    await this.page.getByRole('textbox', { name: 'e.g. Adv. Rajesh Kumar' }).fill(name);
    await this.page.getByRole('heading', { name }).click();
  }

  /** Update the phone number field */
  async updatePhone(phone: string) {
    await this.page.getByRole('textbox', { name: '+91 98765' }).fill(phone);
  }

  /** Update the firm/organisation name and confirm the selection */
  async updateFirm(firm: string) {
    await this.page.getByRole('textbox', { name: 'e.g. Kumar & Associates' }).fill(firm);
    await this.page.locator('div').filter({ hasText: new RegExp(`^${firm}$`) }).click();
    await this.page.getByTitle(firm).click();
  }

  /** Click the Save Profile button */
  async saveProfile() {
    await this.page.getByRole('button', { name: 'Save Profile' }).click();
  }

  /** Assert the "Saved Successfully" toast is visible */
  async verifySaved() {
    await expect(this.page.getByText('Saved Successfully')).toBeVisible({ timeout: 10_000 });
  }

  /** Navigate back to the dashboard from the profile page */
  async backToDashboard() {
    await this.page.getByRole('button', { name: 'Back to Dashboard' }).click();
  }
}
