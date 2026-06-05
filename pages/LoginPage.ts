import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page:          Page;
  readonly emailField:    Locator;
  readonly passwordField: Locator;
  readonly loginButton:   Locator;
  readonly skipTourButton: Locator;

  private readonly url = 'https://demo.pracsys.simplertoday.ai/login';

  constructor(page: Page) {
    this.page           = page;
    this.emailField     = page.getByRole('textbox', { name: 'name@firm.com' });
    // input[type="password"] is the most reliable selector for password fields.
    // getByRole('textbox', { name: '••••••••' }) was wrong — those are typed
    // masking dots, NOT the placeholder/accessible name of the input.
    this.passwordField  = page.locator('input[type="password"]');
    // Actual button text is "Login to Workspace →"; regex handles any arrow/suffix variation.
    this.loginButton    = page.getByRole('button',  { name: /login to workspace/i });
    this.skipTourButton = page.getByRole('button',  { name: 'Skip Tour' });
  }

  /** Navigate to the login page */
  async goto() {
    await this.page.goto(this.url);
  }

  /** Fill only the email field */
  async fillEmail(email: string) {
    await this.emailField.fill(email);
  }

  /** Fill only the password field */
  async fillPassword(password: string) {
    await this.passwordField.fill(password);
  }

  /** Submit the login form */
  async clickLogin() {
    // Click the button — more reliable than pressing Enter on the password field,
    // and correctly handles the "Empty Password" test where the field is never focused.
    await this.loginButton.click();
  }

  /** Fill both fields and submit — convenience method for valid login */
  async login(email: string, password: string) {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.clickLogin();
  }

  /** Dismiss the onboarding tour prompt after login */
  async skipTour() {
    await this.skipTourButton.click();
  }
}
