import { Page, Locator } from '@playwright/test';

export class LoginPage {
  private readonly page:          Page;
  private readonly emailField:    Locator;
  private readonly passwordField: Locator;
  private readonly loginButton:   Locator;
  private readonly skipTourButton: Locator;

  constructor(page: Page) {
    this.page           = page;
    this.emailField     = page.getByRole('textbox', { name: 'name@firm.com' });
    this.passwordField  = page.locator('input[type="password"]');
    this.loginButton    = page.getByRole('button', { name: /login to workspace/i });
    this.skipTourButton = page.getByRole('button', { name: 'Skip Tour' });
  }

  /** Navigate to the login page */
  async goto() {
    // Relative path resolves against the project's baseURL (see playwright.config.ts),
    // so this respects whatever BASE_URL is set in .env.
    await this.page.goto('/login');
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
    await this.loginButton.click();
  }

  /** Fill both fields and submit */
  async login(email: string, password: string) {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.clickLogin();
  }

  /** Dismiss the onboarding tour after login (no-op if tour doesn't appear) */
  async skipTour() {
    try {
      await this.skipTourButton.waitFor({ state: 'visible', timeout: 5000 });
      await this.skipTourButton.click();
    } catch {
      // tour not shown for this session — continue
    }
  }
}
