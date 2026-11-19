import { test, expect, Page, Response } from '@playwright/test';
import { AdminTemplatesPage } from '../../pages/AdminTemplatesPage';
import { countRequests } from '../../utils/countRequests';
import { samplePdf } from '../../utils/samplePdf';
import { signedLinkExpiry } from '../../utils/signedLink';
import { ensureMasterAdminSession, MASTER_ADMIN_SESSION } from '../../utils/masterAdminSession';

/**
 * Admin console - Templates → "Upload Document Draft" and the preview of an uploaded file,
 * as the Master Admin. QA for SIM-144 ("Template previews stop working about 15 minutes
 * after upload") on the admin side.
 *
 * The bug: a template's file link was a signed storage URL created once at upload,
 * so it expired a while later and older previews broke. The fix signs the link
 * whenever the template is read (GET /api/admin/templates/:id → fileUrl).
 *
 * Covered here:
 *   - an uploaded PDF is added as a draft and previews on its page, also after a reload;
 *   - every Document Draft uploaded 20+ minutes ago comes back with a link that is
 *     still valid, and previews;
 *   - opt-in (RUN_SLOW_TEMPLATE_PREVIEW=1): the ticket's QA plan — upload, wait
 *     20+ minutes, preview, reload, preview again.
 *
 * Office files are previewed through Microsoft's viewer, whose download of the file
 * isn't visible, so for those only the link and the preview frame are checked.
 *
 * Uploaded test files are drafts (hidden from lawyers) and are deleted after each
 * test; deleting is tested in templates_action.spec.ts. These tests never click
 * Publish, Replace file or Re-profile.
 */

const ADMIN_URL = process.env.ADMIN_URL ?? '';

const TEMPLATES = /^\/api\/admin\/templates$/;  // the list (GET) and uploads (POST)
const TEMPLATE  = /^\/api\/admin\/templates\/[a-f0-9]{24}$/;

const TWENTY_MINUTES = 20 * 60_000;
const OFFICE_FILES   = ['doc', 'docx'];

/** A template as GET /api/admin/templates(/:id) returns it (only the fields used here) */
interface AdminTemplate {
  id:        string;
  name:      string;
  kind:      string;  // "file" for an uploaded Document Draft
  updatedAt: string;
  working?:  { originalName?: string };
  fileUrl?:  string;  // only when one template is read
}

/** The next template the page reads from the server (opening or reloading its page) */
function nextTemplateRead(page: Page): Promise<AdminTemplate> {
  return page
    .waitForResponse(res => res.request().method() === 'GET' && TEMPLATE.test(new URL(res.url()).pathname))
    .then(async res => (await res.json()).data);
}

/** The next file the preview loads from storage */
function nextFileLoad(page: Page): Promise<Response> {
  return page.waitForResponse(res => new URL(res.url()).host === 'storage.googleapis.com', { timeout: 30_000 });
}

/** Extension of a file name, e.g. "docx" */
function extensionOf(fileName: string | undefined): string {
  return (fileName?.split('.').pop() ?? '').toLowerCase();
}

let templatesPage: AdminTemplatesPage;

/**
 * The template was read with a file link that is still valid, and its Content tab
 * previews the file from that link. `fileLoad` is null for Office files.
 */
async function expectPreview(template: AdminTemplate, fileLoad: Response | null) {
  const expiry = signedLinkExpiry(template.fileUrl);
  expect(expiry, `"${template.name}" came back without a signed file link`).not.toBeNull();
  // A link signed on read is valid now; one stored at upload has long expired.
  // The one-minute margin keeps a link that is about to lapse from passing.
  expect(expiry!, `the file link of "${template.name}" (updated ${template.updatedAt}) has expired — not signed on read? (SIM-144)`)
    .toBeGreaterThan(Date.now() + 60_000);

  await expect(templatesPage.previewFrame).toBeVisible({ timeout: 15_000 });
  if (fileLoad) {
    expect(new URL(fileLoad.url()).pathname, 'the preview loaded a different file').toBe(new URL(template.fileUrl!).pathname);
    expect(fileLoad.status(), `the preview of "${template.name}" failed to load its file — expired link? (SIM-144)`).toBe(200);
  }
}

/** Upload one test file named "QA Template <timestamp>.<extension>"; afterEach deletes it if it was added */
async function uploadTestFile(page: Page, extension: string, mimeType: string, buffer: Buffer) {
  const stamp = String(Date.now());
  test.info().annotations.push({ type: 'cleanup', description: stamp });
  const name = `QA Template ${stamp}`;
  const uploadRequests = countRequests(page, 'POST', TEMPLATES);
  await templatesPage.uploadDocumentDraft([{ name: `${name}.${extension}`, mimeType, buffer }]);
  return { stamp, name, fileName: `${name}.${extension}`, uploadRequests };
}

test.use({ storageState: MASTER_ADMIN_SESSION });

test.beforeAll(async ({ browser }) => {
  const skipReason = await ensureMasterAdminSession(browser);
  test.skip(skipReason !== null, skipReason ?? '');
});

test.beforeEach(async ({ page }) => {
  templatesPage = new AdminTemplatesPage(page);
  await page.goto(new URL('/dashboard', ADMIN_URL).href);
  await templatesPage.open();
});

test.afterEach(async ({ context }) => {
  // Keep the saved session current: the console rotates its refresh token
  await context.storageState({ path: MASTER_ADMIN_SESSION });

  // Delete the file this test uploaded, if it was added
  const cleanup = test.info().annotations.find(a => a.type === 'cleanup');
  if (cleanup?.description) {
    await templatesPage.deleteTemplateIfPresent(cleanup.description);
    await context.storageState({ path: MASTER_ADMIN_SESSION });
  }
});

// ──────────────────────────────────────────────────────────────
// ✅  POSITIVE SCENARIOS
// ──────────────────────────────────────────────────────────────
test.describe('Admin Template Preview - Positive Scenarios', () => {
  test('Upload a PDF: it is added as a Document Draft hidden from lawyers, and previews on its page, also after a reload', async ({ page }) => {
    test.setTimeout(120_000);  // upload + list + preview + reload + delete

    // --- Upload: one request; the draft is listed with its file name ---
    const { stamp, name, fileName, uploadRequests } = await uploadTestFile(page, 'pdf', 'application/pdf', samplePdf(`QA preview ${Date.now()}`));
    await expect(templatesPage.templateAdded).toBeVisible({ timeout: 15_000 });
    await expect(templatesPage.hiddenFromLawyers).toBeVisible();
    expect(uploadRequests(), 'the upload sent no request').toBe(1);

    await templatesPage.search(stamp);
    await expect(templatesPage.row(name)).toContainText(fileName, { timeout: 15_000 });
    await expect(templatesPage.row(name).getByRole('cell', { name: 'Document Draft', exact: true })).toBeVisible();
    await expect(templatesPage.row(name).getByRole('cell', { name: 'Draft', exact: true })).toBeVisible();

    // --- Its page previews the file, from a link signed when the page read it ---
    let read     = nextTemplateRead(page);
    let fileLoad = nextFileLoad(page);
    await templatesPage.openTemplate(name);
    await expect(page.getByRole('main').getByText(`Document Draft · ${fileName}`)).toBeVisible();
    await expectPreview(await read, await fileLoad);

    // --- After a reload: read again, previews again ---
    read     = nextTemplateRead(page);
    fileLoad = nextFileLoad(page);
    await page.reload();
    await expect(templatesPage.detailsHeading).toHaveText(name, { timeout: 15_000 });
    await expectPreview(await read, await fileLoad);
  });

  test('Document Drafts uploaded 20+ minutes ago come back with a link that is still valid, and preview', async ({ page }) => {
    test.setTimeout(180_000);  // opens every older Document Draft

    // The list the Document Draft filter loads
    const listed = page.waitForResponse(res => res.request().method() === 'GET' &&
      TEMPLATES.test(new URL(res.url()).pathname) && new URL(res.url()).searchParams.has('category'));
    await templatesPage.filterByCategory('Document Draft');
    const drafts: AdminTemplate[] = (await (await listed).json()).data.data;

    // updatedAt is the last change, so the file itself is at least that old
    const older = drafts.filter(t => t.kind === 'file' && Date.now() - Date.parse(t.updatedAt) > TWENTY_MINUTES);
    test.skip(older.length === 0, 'no Document Draft older than 20 minutes — run with RUN_SLOW_TEMPLATE_PREVIEW=1 instead');

    for (const template of older) {
      const office   = OFFICE_FILES.includes(extensionOf(template.working?.originalName));
      const read     = nextTemplateRead(page);
      const fileLoad = office ? null : nextFileLoad(page);
      await page.goto(new URL(`/templates/${template.id}`, ADMIN_URL).href);
      await expect(templatesPage.detailsHeading).toHaveText(template.name, { timeout: 15_000 });
      await expectPreview(await read, fileLoad && await fileLoad);
    }
    console.log(`Checked ${older.length} Document Drafts updated 20+ minutes ago`);
  });

  test('A newly uploaded PDF still previews 20+ minutes later, also after a reload', async ({ page }) => {
    // The ticket's own QA plan. It waits 21 minutes, so it is opt-in.
    test.skip(process.env.RUN_SLOW_TEMPLATE_PREVIEW !== '1', 'set RUN_SLOW_TEMPLATE_PREVIEW=1 to run the 20-minute check');
    test.setTimeout(35 * 60_000);

    const { stamp, name } = await uploadTestFile(page, 'pdf', 'application/pdf', samplePdf(`QA preview ${Date.now()}`));
    await expect(templatesPage.templateAdded).toBeVisible({ timeout: 15_000 });
    await templatesPage.search(stamp);
    await templatesPage.openTemplate(name);

    // Past both the 15-minute link life in the bug report and the 20-minute
    // mark in the acceptance criteria.
    await page.waitForTimeout(21 * 60_000);

    for (let round = 1; round <= 2; round++) {
      const read     = nextTemplateRead(page);
      const fileLoad = nextFileLoad(page);
      await page.reload();
      await expect(templatesPage.detailsHeading).toHaveText(name, { timeout: 15_000 });
      await expectPreview(await read, await fileLoad);
    }
  });
});

// ──────────────────────────────────────────────────────────────
// ❌  NEGATIVE SCENARIOS
// ──────────────────────────────────────────────────────────────
test.describe('Admin Template Preview - Negative Scenarios', () => {
  test('A file that is not PDF, Word or text is refused with a message, and nothing is uploaded', async ({ page }) => {
    // The picker only offers PDF, Word and text files; Playwright's setFiles goes around that, as "All files" in the picker would
    const { fileName, uploadRequests } = await uploadTestFile(page, 'png', 'image/png', Buffer.from('QA test image'));

    await expect(templatesPage.uploadRefused).toBeVisible({ timeout: 10_000 });
    await expect(templatesPage.unsupportedFile(fileName)).toBeVisible();
    expect(uploadRequests(), 'the refused file was still uploaded').toBe(0);
  });

  test('An empty PDF (0 bytes) is refused, and nothing is uploaded', async ({ page }) => {
    // Known issue (4 Nov 2026): the console accepts an empty file and adds it as a template.
    // Marked as expected to fail: Playwright reports this test as soon as the app starts refusing empty files.
    test.fail(true, 'Known issue: an empty (0-byte) PDF is accepted as a template — confirm the expected behaviour with the developers');

    const { uploadRequests } = await uploadTestFile(page, 'pdf', 'application/pdf', Buffer.alloc(0));

    await expect(templatesPage.uploadRefused).toBeVisible({ timeout: 10_000 });
    expect(uploadRequests(), 'the empty file was uploaded').toBe(0);
  });
});
