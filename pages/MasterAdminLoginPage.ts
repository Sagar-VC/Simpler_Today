import { Page, Locator, Response } from '@playwright/test';

/**
 * Master Admin sign-in on the admin console (ADMIN_URL in .env).
 *
 * Two steps: email + password, then a six-digit code from the authenticator
 * app ("Two-step verification"). The console calls its API on a separate host,
 * so requests are matched by path (/api/admin/auth/...), not by origin.
 */
export class MasterAdminLoginPage {
  private readonly page: Page;
  private readonly url:  string;

  // ── Step 1: email and password
  readonly signInHeading:      Locator;
  readonly emailField:         Locator;
  readonly passwordField:      Locator;
  readonly showPasswordButton: Locator;
  readonly hidePasswordButton: Locator;
  readonly signInButton:       Locator;
  readonly signInFailed:       Locator;

  // ── Step 2: two-step verification
  readonly twoStepHeading:            Locator;
  readonly codeField:                 Locator;
  readonly verifyButton:              Locator;
  readonly useDifferentAccountButton: Locator;
  readonly codeRejected:              Locator;

  // ── Signed in (from the recorded flow)
  readonly dashboardHeading:  Locator;
  readonly accountMenuButton: Locator;
  readonly signOutMenuItem:   Locator;

  constructor(page: Page, url: string) {
    this.page = page;
    this.url  = url;

    this.signInHeading      = page.getByRole('heading', { name: 'Sign in', exact: true });
    this.emailField         = page.getByRole('textbox', { name: 'Email address' });
    this.passwordField      = page.getByRole('textbox', { name: 'Password', exact: true });
    this.showPasswordButton = page.getByRole('button', { name: 'Show password' });
    this.hidePasswordButton = page.getByRole('button', { name: 'Hide password' });
    // exact: "Verify and sign in" on step 2 also contains "sign in"
    this.signInButton       = page.getByRole('button', { name: 'Sign in', exact: true });
    // A wrong password shows a toast, not a role="alert" field message
    this.signInFailed       = page.getByText('Sign in failed');

    this.twoStepHeading            = page.getByRole('heading', { name: 'Two-step verification' });
    this.codeField                 = page.getByRole('textbox', { name: 'Verification code' });
    this.verifyButton              = page.getByRole('button', { name: 'Verify and sign in' });
    this.useDifferentAccountButton = page.getByRole('button', { name: 'Use a different account' });
    this.codeRejected              = page.getByRole('alert').filter({ hasText: /code wasn.t accepted/i });

    this.dashboardHeading  = page.getByRole('heading', { name: 'Dashboard' });
    // The account button is named "<initials> <display name>", e.g. "SA Super Admin"
    this.accountMenuButton = page.getByRole('button', { name: /^[A-Z]{1,2} .*admin/i });
    this.signOutMenuItem   = page.getByRole('menuitem', { name: 'Sign out' });
  }

  /** Open the admin console sign-in page */
  async goto() {
    await this.page.goto(this.url);
  }

  /** Field validation message shown under the email or password field */
  fieldError(message: string): Locator {
    return this.page.getByRole('alert').filter({ hasText: message });
  }

  /** Fill only the email field */
  async fillEmail(email: string) {
    await this.emailField.fill(email);
  }

  /** Fill only the password field */
  async fillPassword(password: string) {
    await this.passwordField.fill(password);
  }

  /** Submit step 1 */
  async clickSignIn() {
    await this.signInButton.click();
  }

  /** Fill email and password and submit */
  async login(email: string, password: string) {
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.clickSignIn();
  }

  /** Submit step 1 and return the server's answer to the sign-in request */
  async loginAndWaitForResponse(email: string, password: string): Promise<Response> {
    const response = this.page.waitForResponse(
      res => res.url().includes('/api/admin/auth/login') && res.request().method() === 'POST'
    );
    await this.login(email, password);
    return response;
  }

  /** Submit step 2 and return the server's answer to the code check */
  async verifyCode(code: string): Promise<Response> {
    const response = this.page.waitForResponse(
      res => res.url().includes('/api/admin/auth/mfa/verify') && res.request().method() === 'POST'
    );
    await this.codeField.fill(code);
    await this.verifyButton.click();
    return response;
  }

  /** Sign out from the account menu */
  async signOut() {
    await this.accountMenuButton.click();
    await this.signOutMenuItem.click();
  }
}
