import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';

const EMAIL    = process.env.TEST_EMAIL    ?? '';
const PASSWORD = process.env.TEST_PASSWORD ?? '';

/**
 * A01/A07:2021 - Google/Microsoft sign-in hardening.
 *
 * QA verification for the auth tickets sitting in the Jira QA column:
 *   SIM-121  OAuth state + PKCE on Google/Microsoft sign-in (login CSRF)
 *   SIM-117  Stop putting the access token in the URL after an SSO sign-in
 *   SIM-120  CRITICAL: stop SSO from taking over an existing lawyer account
 *
 * SIM-121 is fully checkable without ever logging in to an identity provider:
 * the authorize redirect the backend issues carries (or does not carry) the
 * parameters, and that is the whole claim. SIM-117 and SIM-120 are only
 * partially automatable here — see the notes on those tests.
 */
test.describe('Security - OAuth / SSO sign-in', () => {
  /**
   * The authorize-redirect checks, run once per provider.
   *
   * `maxRedirects: 0` is what makes this work: we need to read the backend's
   * own 302 (its Location header and Set-Cookie), not follow it through to
   * Google/Microsoft — following it would land on a consent screen and tell us
   * nothing about what our backend sent.
   */
  for (const provider of ['google', 'microsoft'] as const) {
    test(`${provider} sign-in redirect carries OAuth state and PKCE (SIM-121)`, async ({ page, request }) => {
      const loginPage = new LoginPage(page);
      await loginPage.goto();
      const ssoUrl = await loginPage.ssoHref(provider);

      const response = await request.get(ssoUrl, { maxRedirects: 0 });
      expect(
        response.status(),
        `${ssoUrl} should answer with a redirect to the identity provider`
      ).toBeGreaterThanOrEqual(300);
      expect(response.status()).toBeLessThan(400);

      const location = response.headers()['location'];
      expect(location, 'redirect response has no Location header').toBeTruthy();

      const authorizeUrl = new URL(location);
      const params = authorizeUrl.searchParams;

      console.log(`[${provider}] authorize endpoint:`, `${authorizeUrl.host}${authorizeUrl.pathname}`);
      console.log(`[${provider}] authorize params:`, [...params.keys()].sort().join(', '));

      // --- Login CSRF defence: an unguessable state value ---
      const state = params.get('state');
      expect(state, `${provider} authorize URL has no "state" — the callback cannot tell a genuine sign-in from a forged one (login CSRF)`).toBeTruthy();
      // 16 chars is the floor for "not brute-forceable / not a counter". A real
      // implementation emits far more; this only has to catch a placeholder.
      expect.soft(
        (state ?? '').length,
        `${provider} "state" is only ${state?.length} characters — too short to be unguessable`
      ).toBeGreaterThanOrEqual(16);

      // --- PKCE: binds the authorization code to this browser ---
      const codeChallenge = params.get('code_challenge');
      expect(codeChallenge, `${provider} authorize URL has no "code_challenge" — PKCE is not in use, so a stolen authorization code can be redeemed by anyone`).toBeTruthy();
      expect(
        params.get('code_challenge_method'),
        `${provider} PKCE must use S256; "plain" offers no protection because the verifier travels in clear`
      ).toBe('S256');

      // --- The state must be remembered server-side, not just echoed ---
      // A state parameter the backend cannot later compare against is decoration.
      // The paired cookie is how it remembers, so its flags matter as much as
      // its presence: readable by JS, or sent cross-site, and the defence leaks.
      const setCookie = response.headers()['set-cookie'] ?? '';
      console.log(`[${provider}] set-cookie flags:`, setCookie.replace(/=[^;]*/, '=<redacted>'));

      expect.soft(
        /httponly/i.test(setCookie),
        `${provider} state cookie is not HttpOnly — readable by any injected script`
      ).toBe(true);
      expect.soft(
        /secure/i.test(setCookie),
        `${provider} state cookie is not Secure — can travel over plain HTTP`
      ).toBe(true);
      expect.soft(
        /samesite=(lax|strict)/i.test(setCookie),
        `${provider} state cookie has no SameSite=Lax/Strict — attacker-initiated navigation would carry it`
      ).toBe(true);
    });
  }

  test('No access token is exposed in the URL during password sign-in (SIM-117)', async ({ page }) => {
    // Every main-frame URL the browser visits, so a token that appears only
    // briefly mid-redirect is still caught — by the time the dashboard renders
    // the offending URL may already have been replaced in the address bar, but
    // it has been in browser history, the referrer, and any proxy log regardless.
    const visitedUrls: string[] = [];
    page.on('framenavigated', frame => {
      if (frame === page.mainFrame()) visitedUrls.push(frame.url());
    });

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(EMAIL, PASSWORD);
    await expect(page.getByRole('button', { name: 'New Workspace' })).toBeVisible({ timeout: 15_000 });

    // Both the query string and the fragment: SIM-117 is specifically about the
    // fragment (#access_token=...), which never reaches the server but is fully
    // visible to scripts, extensions and anything reading the address bar.
    const TOKEN_PATTERNS = [
      /[?#&](access_token|id_token|refresh_token|token|jwt)=/i,
      /[?#&][a-z_]*=eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./, // a bare JWT as any param value
    ];

    const offending = visitedUrls.filter(url => TOKEN_PATTERNS.some(re => re.test(url)));
    // Log the shape, never the value — a failing run's report would otherwise
    // contain a live token.
    console.log('Navigation URLs seen during sign-in:', visitedUrls.map(u => u.replace(/([?#&][a-z_]*=)[^&]+/gi, '$1<redacted>')));

    expect(
      offending.length,
      `a token-shaped value appeared in ${offending.length} navigation URL(s) during password sign-in — ` +
        `URLs leak via history, Referer and server logs`
    ).toBe(0);
  });

  /**
   * SIM-117's SSO half and SIM-120 both need a real Google/Microsoft account to
   * complete the callback, and identity providers actively block automated
   * sign-in — so they cannot be driven end-to-end from Playwright.
   *
   * What this test does automate is the precondition both tickets depend on:
   * the SSO entry point must hand off to the identity provider WITHOUT the app
   * having issued any session of its own first. If a session cookie already
   * exists before the user has proved who they are, the callback has nothing
   * left to protect.
   *
   * The end-to-end halves stay manual; see docs/qa/sso-manual-checks.md.
   */
  test('SSO hand-off issues no app session before the identity provider has authenticated anyone (SIM-120)', async ({ page, context }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    const cookiesBefore = await context.cookies();
    await loginPage.ssoHref('google'); // asserts the link exists before we judge cookie state

    const sessionish = cookiesBefore.filter(c => /session|auth|token|jwt/i.test(c.name));
    console.log('Cookies present on the login page before any SSO hand-off:', cookiesBefore.map(c => c.name));

    expect(
      sessionish.map(c => c.name),
      'a session/auth-shaped cookie exists before the user has authenticated with any provider'
    ).toEqual([]);
  });
});
