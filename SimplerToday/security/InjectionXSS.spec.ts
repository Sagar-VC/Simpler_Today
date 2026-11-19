import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { UserProfilePage } from '../../pages/UserProfilePage';

const EMAIL    = process.env.TEST_EMAIL    ?? '';
const PASSWORD = process.env.TEST_PASSWORD ?? '';

// Non-executing marker: if the app ever renders this unescaped, it sets a JS
// global instead of popping a blocking alert() dialog.
const XSS_PAYLOAD = '<img src=x onerror="window.__xssFired=true">';

/**
 * A03:2021 - Injection / output-encoding checks beyond today's client-side-only
 * format validation (see Login.spec.ts / forgotpassword.spec.ts, which only
 * assert malformed input blocks submission, not what the server does with it).
 */
test.describe('Security - Injection & Output Encoding', () => {
  test('Profile full-name field does not execute injected markup on save + reload', async ({ page }) => {
    test.setTimeout(60_000);
    const loginPage   = new LoginPage(page);
    const profilePage = new UserProfilePage(page);

    await loginPage.goto();
    await loginPage.login(EMAIL, PASSWORD);
    await loginPage.skipTour();

    await profilePage.openProfile();
    await profilePage.updateFullName(XSS_PAYLOAD);
    await profilePage.saveProfile();
    await profilePage.verifySaved();

    await page.reload();

    const fired = await page.evaluate(() => (window as any).__xssFired);
    expect(
      fired,
      'injected <img onerror> should not execute after reload — indicates unescaped stored XSS'
    ).toBeUndefined();

    const bodyHtml = await page.locator('body').innerHTML();
    expect(
      bodyHtml.includes('<img src=x onerror'),
      'raw payload markup should not appear unescaped in the rendered DOM'
    ).toBe(false);

    // Restore a clean profile name so later suite runs aren't polluted by this payload
    // (registernewuser.spec.ts's "Update profile" test expects "Anurag QA").
    await profilePage.updateFullName('Anurag QA');
    await profilePage.saveProfile();
    await profilePage.verifySaved();
  });

  test('SQL-injection-style credentials fail login normally, with no server error leak', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    const postStatuses: number[] = [];
    page.on('response', res => {
      if (res.request().method() === 'POST') postStatuses.push(res.status());
    });

    await loginPage.login(`${EMAIL}' OR '1'='1' -- `, "' OR '1'='1' --");

    // No auth bypass: still on/back at the login page.
    await expect(page.getByRole('button', { name: /login to workspace/i })).toBeVisible({ timeout: 10_000 });
    // No crash: the login endpoint shouldn't 5xx on malformed/injection input.
    expect(
      postStatuses.some(status => status >= 500),
      `login endpoint returned a 5xx for injection-style input (statuses seen: ${JSON.stringify(postStatuses)})`
    ).toBe(false);
  });
});
