import { Page, Locator } from '@playwright/test';

export class LoginPage {
  private readonly page:          Page;
  private readonly emailField:    Locator;
  private readonly passwordField: Locator;
  private readonly loginButton:   Locator;
  private readonly skipTourButton: Locator;

  // SSO entry points. These are anchors (<a href>), not buttons — confirmed
  // against the live login page — so getByRole('link') is the correct query;
  // getByRole('button') finds nothing here.
  readonly googleSsoLink:    Locator;
  readonly microsoftSsoLink: Locator;

  constructor(page: Page) {
    this.page           = page;
    this.emailField     = page.getByRole('textbox', { name: 'name@firm.com' });
    this.passwordField  = page.locator('input[type="password"]');
    this.loginButton    = page.getByRole('button', { name: /login to workspace/i });
    this.skipTourButton = page.getByRole('button', { name: 'Skip Tour' });

    this.googleSsoLink    = page.getByRole('link', { name: /continue with google/i });
    this.microsoftSsoLink = page.getByRole('link', { name: /continue with microsoft/i });
  }

  /**
   * The backend URL an SSO link points at (e.g. .../api/auth/google).
   *
   * Read from the DOM rather than derived from baseURL: the API lives on a
   * different host than the app (api-pracsys vs pracsys), and that mapping is
   * the app's business, not something these tests should hard-code per
   * environment. Caller must already be on the login page.
   */
  async ssoHref(provider: 'google' | 'microsoft'): Promise<string> {
    const link = provider === 'google' ? this.googleSsoLink : this.microsoftSsoLink;
    await link.waitFor({ state: 'visible', timeout: 15_000 });
    const href = await link.getAttribute('href');
    if (!href) throw new Error(`"Continue with ${provider}" link has no href attribute`);
    return href;
  }

  /** Navigate to the login page */
  async goto() {
    // Relative path resolves against the project's baseURL (see playwright.config.ts),
    // so this respects whatever BASE_URL is set in .env.
    //
    // Retries on net::ERR_ABORTED — this navigation occasionally gets aborted
    // immediately when it starts right as the previous test's browser context
    // is still finishing teardown (trace/video flush) in the shared, single-worker
    // browser process. Any other error is rethrown immediately.
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.page.goto('/login');
        return;
      } catch (error) {
        const isAborted = error instanceof Error && error.message.includes('net::ERR_ABORTED');
        if (!isAborted || attempt === maxAttempts) throw error;
        await this.page.waitForTimeout(1000);
      }
    }
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

  /** Sign out via the avatar menu's "Log out" action, ending the session. */
  async logout() {
    await this.page.getByRole('button', { name: /^[A-Za-z]{1,2}$/ }).click();
    await this.page.getByRole('button', { name: 'Log out' }).click();
  }
}
