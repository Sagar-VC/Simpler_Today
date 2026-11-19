import { test, expect } from '@playwright/test';
import { hasSecurityHeader } from '../../utils/securityHelpers';

// content-security-policy is checked separately below (it distinguishes
// enforced vs. Report-Only, which a flat presence check would blur together).
const RECOMMENDED_HEADERS = ['x-content-type-options', 'strict-transport-security', 'referrer-policy'];

/**
 * A05:2021 - Security Misconfiguration: presence of recommended response
 * security headers on the main document. Soft-asserted — a missing header is
 * a finding for the report, not something this suite can fix, so every check
 * should still run and be recorded rather than stopping at the first miss.
 */
test.describe('Security - Response Headers', () => {
  test('Login page sets recommended security headers', async ({ page }) => {
    const response = await page.goto('/login');
    expect(response, 'expected a response for /login').not.toBeNull();

    const headers = response!.headers();
    console.log('Response headers on /login:', JSON.stringify(headers, null, 2));

    for (const header of RECOMMENDED_HEADERS) {
      expect.soft(hasSecurityHeader(headers, header), `missing recommended header: ${header}`).toBe(true);
    }

    // A CSP shipped only as Report-Only logs violations but blocks nothing —
    // call that out distinctly rather than lumping it in with "no CSP at all".
    const hasEnforcedCsp   = hasSecurityHeader(headers, 'content-security-policy');
    const hasReportOnlyCsp = hasSecurityHeader(headers, 'content-security-policy-report-only');
    expect.soft(
      hasEnforcedCsp,
      hasReportOnlyCsp
        ? 'CSP is present only as Content-Security-Policy-Report-Only — it logs violations but does not block anything; promote it to an enforced Content-Security-Policy header'
        : 'missing recommended header: content-security-policy'
    ).toBe(true);

    // Clickjacking protection: either X-Frame-Options or a CSP frame-ancestors directive
    // (an enforced one — frame-ancestors in a report-only CSP does not actually block framing).
    const enforcedCsp = headers['content-security-policy'] ?? '';
    const hasFrameProtection = hasSecurityHeader(headers, 'x-frame-options') || /frame-ancestors/i.test(enforcedCsp);
    expect.soft(
      hasFrameProtection,
      'no clickjacking protection found: missing both X-Frame-Options and an enforced CSP frame-ancestors directive'
    ).toBe(true);
  });
});
