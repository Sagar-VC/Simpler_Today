import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import { LoginPage } from '../pages/LoginPage';
import { DocumentDraftsPage } from '../pages/DocumentDraftsPage';

/**
 * QA verification for SIM-144 ("Template previews stop working about 15 minutes
 * after upload").
 *
 * The bug: a template's preview link was a signed storage URL created once at
 * upload and stored, so it expired a short while later and every older
 * template's preview broke. The fix signs the link when the template is read.
 *
 * Covered here:s
 *   - every template uploaded 20+ minutes ago comes back from the library with a
 *     link that is still valid (i.e. signed on read, not at upload);
 *   - such a template's preview actually opens, and again after a reload — the
 *     ticket's first acceptance criterion;
 *   - opt-in (RUN_SLOW_TEMPLATE_PREVIEW=1): the ticket's exact QA plan — upload a
 *     template, wait 20+ minutes, preview, reload, preview again.
 *
 * Not covered: "the AI sync payload carries a fresh link" travels between the
 * backend and the AI service and is not visible from the browser. Office files
 * are previewed through Microsoft's viewer, whose download of the file isn't
 * visible either, so the preview checks use PDFs and images.
 */

const EMAIL    = process.env.TEST_EMAIL    ?? '';
const PASSWORD = process.env.TEST_PASSWORD ?? '';

const PDF_PATH = 'C:/Users/Sagar Panchal/Downloads/Analysis-Report-v1 (1).pdf';

const TWENTY_MINUTES      = 20 * 60_000;
const BROWSER_PREVIEWABLE = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp'];

interface Template { name: string; category: string; extension: string; createdAt: string; storeFileName: string; fileUrl?: string }
interface TemplateRead { at: number; templates: Template[] }

/** Expiry (ms) of a signed storage link — V2 (`Expires`) or V4 (`X-Goog-Date` + `X-Goog-Expires`); null if unsigned. */
function signedLinkExpiry(url: string | undefined): number | null {
  if (!url) return null;
  const params = new URL(url).searchParams;
  if (params.has('Expires')) return Number(params.get('Expires')) * 1000;
  const date = params.get('X-Goog-Date'); // e.g. 20261027T051000Z
  if (date && params.has('X-Goog-Expires')) {
    const iso = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${date.slice(9, 11)}:${date.slice(11, 13)}:${date.slice(13, 15)}Z`;
    return Date.parse(iso) + Number(params.get('X-Goog-Expires')) * 1000;
  }
  return null;
}

/** Record every template-list answer (GET /api/templates) with the time it arrived. */
function recordTemplateReads(page: Page): TemplateRead[] {
  const reads: TemplateRead[] = [];
  page.on('response', async res => {
    if (res.request().method() !== 'GET' || new URL(res.url()).pathname !== '/api/templates') return;
    try {
      reads.push({ at: Date.now(), templates: (await res.json()).data ?? [] });
    } catch {
      // body unavailable (e.g. page navigated away mid-response)
    }
  });
  return reads;
}

/** The latest template-list answer that arrived after `since`. */
async function readAfter(reads: TemplateRead[], since: number): Promise<TemplateRead> {
  await expect
    .poll(() => reads.some(r => r.at >= since), { message: 'the template list was never fetched', timeout: 20_000 })
    .toBe(true);
  const fresh = reads.filter(r => r.at >= since);
  return fresh[fresh.length - 1];
}

async function login(page: Page) {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(EMAIL, PASSWORD);
  await loginPage.skipTour();
}

/** Preview a template and assert its file actually loads from storage. */
async function previewAndCheckFile(page: Page, drafts: DocumentDraftsPage, template: Template) {
  // Storage paths embed the stored file name; its leading UUID needs no URL-encoding.
  const fileId   = template.storeFileName.slice(0, 36);
  const fileLoad = page.waitForResponse(res => res.url().includes(fileId), { timeout: 30_000 });
  await drafts.preview(template.name);
  await drafts.verifyPreviewOpen(template.name);
  expect(
    (await fileLoad).status(),
    `the preview of "${template.name}" (uploaded ${template.createdAt}) failed to load its file — expired link? (SIM-144)`
  ).toBe(200);
  await drafts.closePreview();
}

test.describe('Template Library - Preview links (SIM-144)', () => {
  test('Templates uploaded 20+ minutes ago come back with a link that is still valid', async ({ page }) => {
    const drafts = new DocumentDraftsPage(page);
    const reads  = recordTemplateReads(page);
    const since  = Date.now();

    await login(page);
    await drafts.open();
    const read = await readAfter(reads, since);

    const older = read.templates.filter(
      t => signedLinkExpiry(t.fileUrl) !== null && read.at - Date.parse(t.createdAt) > TWENTY_MINUTES
    );
    test.skip(older.length === 0, 'no template with a stored file is older than 20 minutes on this account');

    // A link signed on read is valid now; one stored at upload has long expired.
    // The one-minute margin keeps a link that is about to lapse from passing.
    const expired = older
      .filter(t => signedLinkExpiry(t.fileUrl)! <= read.at + 60_000)
      .map(t => `${t.name} (uploaded ${t.createdAt}, link expires ${new Date(signedLinkExpiry(t.fileUrl)!).toISOString()})`);
    console.log(`Checked ${older.length} templates uploaded 20+ minutes ago`);
    expect(expired, `template links were not re-signed on read (SIM-144):\n${expired.join('\n')}`).toEqual([]);
  });

  test('A template uploaded 20+ minutes ago previews, also after a reload', async ({ page }) => {
    const drafts = new DocumentDraftsPage(page);
    const reads  = recordTemplateReads(page);
    const since  = Date.now();

    await login(page);
    await drafts.open();
    const read = await readAfter(reads, since);

    // The oldest template the browser renders itself (see the file comment on Office files).
    const target = read.templates
      .filter(t => t.category === 'Document Draft' && BROWSER_PREVIEWABLE.includes(t.extension?.toLowerCase()))
      .filter(t => read.at - Date.parse(t.createdAt) > TWENTY_MINUTES)
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))[0];
    test.skip(!target, 'no PDF/image Document Draft older than 20 minutes — run with RUN_SLOW_TEMPLATE_PREVIEW=1 instead');
    console.log(`Previewing "${target.name}" (uploaded ${target.createdAt})`);

    await previewAndCheckFile(page, drafts, target);

    await page.reload();
    if (!(await page.getByRole('heading', { name: 'Template Library' }).isVisible())) await drafts.open();
    await previewAndCheckFile(page, drafts, target);
  });

  test('A newly uploaded template still previews 20+ minutes later', async ({ page }) => {
    // The ticket's own QA plan. It waits 21 minutes, so it is opt-in.
    test.skip(process.env.RUN_SLOW_TEMPLATE_PREVIEW !== '1', 'set RUN_SLOW_TEMPLATE_PREVIEW=1 to run the 20-minute check');
    test.setTimeout(35 * 60_000);

    const drafts = new DocumentDraftsPage(page);
    const reads  = recordTemplateReads(page);
    const name   = `SIM-144 Preview ${Date.now()}`;

    await login(page);
    await drafts.open();
    await drafts.upload({ name: `${name}.pdf`, mimeType: 'application/pdf', buffer: fs.readFileSync(PDF_PATH) });

    try {
      // Past both the 15-minute link life in the bug report and the 20-minute
      // mark in the acceptance criteria.
      await page.waitForTimeout(21 * 60_000);

      for (let round = 1; round <= 2; round++) {
        const since = Date.now();
        await page.reload();
        if (!(await page.getByRole('heading', { name: 'Template Library' }).isVisible())) await drafts.open();
        const template = (await readAfter(reads, since)).templates.find(t => t.name === name);
        expect(template, `the uploaded template "${name}" is missing from the library`).toBeTruthy();
        await previewAndCheckFile(page, drafts, template!);
      }
    } finally {
      // Leave the shared account as it was.
      if (!(await page.getByRole('heading', { name: 'Template Library' }).isVisible())) await drafts.open();
      await drafts.delete(name);
    }
  });
});
