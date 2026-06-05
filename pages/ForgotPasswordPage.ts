import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model for the Forgot Password flow.
 * Covers the forgot-password form and navigation back to login.
 */
export class ForgotPasswordPage {
  readonly page: Page;

  // ── Locators ──────────────────────────────────────────────
  readonly forgotPasswordLink: Locator;  // on the login page
  readonly heading: Locator;             // "Forgot password" heading
  readonly emailField: Locator;
  readonly sendResetLinkButton: Locator;
  readonly successMessage: Locator;      // shown after a valid submission
  readonly backToSignInLink: Locator;
  readonly loginButton: Locator;         // login page button, used after navigating back

  constructor(page: Page) {
    this.page = page;
    this.forgotPasswordLink  = page.getByRole('link',    { name: 'Forgot password?' });
    this.heading             = page.getByRole('heading', { name: 'Forgot password' });
    this.emailField          = page.getByPlaceholder('you@example.com');
    this.sendResetLinkButton = page.getByRole('button',  { name: 'Send reset link' });
    this.successMessage      = page.locator('form').getByText('If the account exists, a');
    this.backToSignInLink    = page.getByRole('link',    { name: 'Back to sign in' });
    this.loginButton         = page.getByRole('button',  { name: 'Login to Workspace' });
  }

  // ── Actions ───────────────────────────────────────────────

  /**
   * Navigate to the login page and open the forgot-password form
   * by clicking the "Forgot password?" link.
   */
  async goto() {
    await this.page.goto('/');
    await this.forgotPasswordLink.click();
  }

  /** Type into the email field only. */
  async fillEmail(email: string) {
    await this.emailField.fill(email);
  }

  /** Click the "Send reset link" submit button. */
  async submit() {
    await this.sendResetLinkButton.click();
  }

  /**
   * Fill the email and submit the reset-link form.
   * Combines fillEmail + submit.
   */
  async requestPasswordReset(email: string) {
    await this.fillEmail(email);
    await this.submit();
  }
}
