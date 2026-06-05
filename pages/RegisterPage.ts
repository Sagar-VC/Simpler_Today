import { Page } from '@playwright/test';

export class RegisterPage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** Click the "Don't have an account?" sign-up link on the login page */
  async clickSignUpLink() {
    await this.page.getByRole('link', { name: "Don't have an account?" }).click();
  }

  /** Fill the Full Name field on the registration form */
  async fillFullName(name: string) {
    await this.page.getByRole('textbox', { name: 'Adv. Rajesh Kumar' }).fill(name);
  }

  /** Fill the Email Address field on the registration form */
  async fillEmail(email: string) {
    await this.page.getByRole('textbox', { name: 'name@firm.com' }).fill(email);
  }

  /** Submit the registration form */
  async clickCreateAccount() {
    await this.page.getByRole('button', { name: 'Create Professional Account' }).click();
  }

  /** Dismiss the onboarding tour after account creation */
  async skipTour() {
    await this.page.getByRole('button', { name: 'Skip Tour' }).click();
  }
}
