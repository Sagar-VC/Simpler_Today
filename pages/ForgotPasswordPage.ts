import { Page, Locator } from '@playwright/test';

export class ForgotPasswordPage {
  private readonly page: Page;

  // ── Locators ──────────────────────────────────────────────────────────────
  private readonly forgotPasswordLink:  Locator;
  private readonly heading:             Locator;
  private readonly emailField:          Locator;
  private readonly sendResetLinkButton: Locator;
  private readonly successMessage:      Locator;
  private readonly backToSignInLink:    Locator;
  private readonly loginButton:         Locator;

  constructor(page: Page) {
    this.page                = page;
    this.forgotPasswordLink  = page.getByRole('link',    { name: 'Forgot password?' });
    this.heading             = page.getByRole('heading', { name: 'Forgot password' });
    this.emailField          = page.getByPlaceholder('you@example.com');
    this.sendResetLinkButton = page.getByRole('button',  { name: 'Send reset link' });
    this.successMessage      = page.locator('form').getByText('If the account exists, a');
    this.backToSignInLink    = page.getByRole('link',    { name: 'Back to sign in' });
    this.loginButton         = page.getByRole('button',  { name: 'Login to Workspace' });
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  /** Navigate to the login page and open the forgot-password form */
  async goto() {
    await this.page.goto('/');
    await this.forgotPasswordLink.click();
  }

  /** Type into the email field */
  async fillEmail(email: string) {
    await this.emailField.fill(email);
  }

  /** Click the "Send reset link" submit button */
  async submit() {
    await this.sendResetLinkButton.click();
  }

  /** Fill the email and submit the reset-link form */
  async requestPasswordReset(email: string) {
    await this.fillEmail(email);
    await this.submit();
  }
}
