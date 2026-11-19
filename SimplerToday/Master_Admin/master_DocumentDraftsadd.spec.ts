import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { AdminTemplatesPage } from '../../pages/AdminTemplatesPage';
import { countRequests } from '../../utils/countRequests';
import { samplePdf } from '../../utils/samplePdf';
import { ensureMasterAdminSession, MASTER_ADMIN_SESSION } from '../../utils/masterAdminSession';

/**
 * Admin console - Templates → "Upload Document Draft", the AI analysis of the uploaded file
 * (its profile) and the Formatting tab's "AI Drafting Blueprint & Variables", as the Master Admin.
 * The admin side of the main app's DocumentDraftsadd.spec.ts; like that test, one test here
 * uploads the real document in TEST_FILE_PATH (skipped when the file isn't on this machine).
 *
 * After an upload the page shows "Profiling…" while the AI reads the file; then the
 * Formatting tab lists the fields it found (Interactive Variables Registry), with
 * Add Custom Field, AI Suggested Fields and "Approve & Save Configuration".
 * Field changes are only kept after Approve & Save.
 *
 * A single upload's toast, list row and preview, and files the upload refuses, are
 * tested in master_templatepreview.spec.ts.
 *
 * Uploaded test files are drafts (hidden from lawyers) and are deleted after each
 * test. These tests never click Publish, Replace file or Re-profile.
 */

const ADMIN_URL = process.env.ADMIN_URL ?? '';

const TEMPLATES = /^\/api\/admin\/templates$/;  // uploads (POST)
const TEMPLATE  = /^\/api\/admin\/templates\/[a-f0-9]{24}$/;

/** The real document the main app's DocumentDraftsadd.spec.ts uploads (a file on the tester's machine) */
const REAL_FILE = process.env.TEST_FILE_PATH ?? '';

/** The file types Upload Document Draft takes */
const MIME_TYPES: Record<string, string> = {
  '.pdf':  'application/pdf',
  '.doc':  'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt':  'text/plain',
};

let templatesPage: AdminTemplatesPage;

/** A test file named "QA Template <timestamp>…": a one-page PDF with blanks for the AI to find, or a text file */
function testFile(name: string, type: 'pdf' | 'txt') {
  const text = `${name} Party name: ____ Date: ____`;
  return type === 'pdf'
    ? { name: `${name}.pdf`, mimeType: 'application/pdf', buffer: samplePdf(text) }
    : { name: `${name}.txt`, mimeType: 'text/plain', buffer: Buffer.from(text) };
}

/** A new timestamp for this test's files; afterEach deletes every template named with it */
function newStamp(): string {
  const stamp = String(Date.now());
  test.info().annotations.push({ type: 'cleanup', description: stamp });
  return stamp;
}

/** Reload until the server says the AI analysis of this template is done, then check the page agrees */
async function waitUntilProfiled(page: Page, timeout = 120_000) {
  await expect.poll(async () => {
    const read = page.waitForResponse(res => res.request().method() === 'GET' && TEMPLATE.test(new URL(res.url()).pathname));
    await page.reload();
    return (await (await read).json()).data.profileStatus;
  }, { message: 'the AI analysis of the uploaded file did not finish', intervals: [5_000, 10_000], timeout }).toBe('done');
  await expect(templatesPage.profiling).toBeHidden();
}
    
/** Upload one PDF, open its page once it is profiled, and go to the Formatting tab; returns the fields the AI registered */
async function uploadAndOpenFormatting(page: Page) {
  const name = `QA Template ${newStamp()}`;
  await templatesPage.uploadDocumentDraft([testFile(name, 'pdf')]);
  await expect(templatesPage.templateAdded).toBeVisible({ timeout: 15_000 });

  await templatesPage.search(name);
  await templatesPage.openTemplate(name);
  await waitUntilProfiled(page);
  await templatesPage.formattingTab.click();
  await expect(templatesPage.registeredCount).toBeVisible({ timeout: 15_000 });
  return { name, before: await templatesPage.registeredFields.allInnerTexts() };
}

test.use({ storageState: MASTER_ADMIN_SESSION });

test.beforeAll(async ({ browser }) => {
  const skipReason = await ensureMasterAdminSession(browser);
  test.skip(skipReason !== null, skipReason ?? '');
});

test.beforeEach(async ({ page }) => {
  test.setTimeout(180_000);  // upload + AI analysis (about 15 s) + checks + delete
  templatesPage = new AdminTemplatesPage(page);
  await page.goto(new URL('/dashboard', ADMIN_URL).href);
  await templatesPage.open();
});

test.afterEach(async ({ context }) => {
  // Keep the saved session current: the console rotates its refresh token
  await context.storageState({ path: MASTER_ADMIN_SESSION });

  // Delete every file this test uploaded (one per call)
  const cleanup = test.info().annotations.find(a => a.type === 'cleanup');
  if (cleanup?.description) {
    for (let i = 0; i < 3 && await templatesPage.deleteTemplateIfPresent(cleanup.description); i++);
    await context.storageState({ path: MASTER_ADMIN_SESSION });
  }
});

// ──────────────────────────────────────────────────────────────
// ✅  POSITIVE SCENARIOS
// ──────────────────────────────────────────────────────────────
test.describe('Admin Document Drafts Add - Positive Scenarios', () => {
  test('Upload a Document Draft: the AI analyses it, and the Formatting tab shows the Drafting Blueprint and Variables Registry', async ({ page }) => {
    const name = `QA Template ${newStamp()}`;

    // --- The upload is saved as a Document Draft draft, waiting for its AI analysis ---
    const uploaded = page.waitForResponse(res => res.request().method() === 'POST' && TEMPLATES.test(new URL(res.url()).pathname));
    await templatesPage.uploadDocumentDraft([testFile(name, 'pdf')]);
    const template = (await (await uploaded).json()).data;
    expect(template).toMatchObject({ name, kind: 'file', status: 'draft', category: 'Document Draft', profileStatus: 'pending' });
    await expect(templatesPage.templateAdded).toBeVisible({ timeout: 15_000 });

    // --- Its page: the analysis finishes ---
    await templatesPage.search(name);
    await templatesPage.openTemplate(name);
    await waitUntilProfiled(page);
    await expect(templatesPage.reProfileButton).toBeEnabled();

    // --- Formatting tab: the blueprint settings and the fields the AI registered ---
    await templatesPage.formattingTab.click();
    await expect(templatesPage.blueprintHeading).toBeVisible({ timeout: 15_000 });
    await expect(templatesPage.blueprintSettings).toHaveCount(3);  // tone, structure, draft depth
    await expect(templatesPage.registryHeading).toBeVisible();
    const fields = await templatesPage.registeredFields.count();
    await expect(templatesPage.registeredCount).toHaveText(`${fields} registered`);
    await expect(templatesPage.customFieldInput).toBeVisible();
    await expect(templatesPage.saveFormattingButton).toBeVisible();
  });

  test('Add custom fields with the Add button and with Enter, Approve & Save: they are kept after a reload, and the template stays a draft', async ({ page }) => {
    const { name, before } = await uploadAndOpenFormatting(page);
    const byButton = `QA Field ${Date.now()}`;
    const byEnter  = `QA Enter ${Date.now()}`;
    const updateRequests = countRequests(page, 'PATCH', TEMPLATE);

    // --- Add button, then Enter: each field is listed and the box is cleared ---
    await templatesPage.addCustomField(byButton);
    await expect(templatesPage.registeredField(byButton)).toBeVisible();
    await expect(templatesPage.customFieldInput).toHaveValue('');
    await templatesPage.customFieldInput.fill(byEnter);
    await templatesPage.customFieldInput.press('Enter');
    await expect(templatesPage.registeredFields).toHaveText([...before, byButton, byEnter]);
    await expect(templatesPage.registeredCount).toHaveText(`${before.length + 2} registered`);
    expect(updateRequests(), 'adding a field saved it before Approve & Save').toBe(0);

    // --- Approve & Save: one update ---
    await templatesPage.saveFormattingButton.click();
    await expect(templatesPage.formattingSaved).toBeVisible({ timeout: 15_000 });
    expect(updateRequests(), 'Approve & Save sent no update').toBe(1);

    // --- After a reload the fields are still there, and saving did not publish it ---
    await page.reload();
    await expect(templatesPage.detailsHeading).toHaveText(name, { timeout: 15_000 });
    await expect(templatesPage.detailsStatus('Draft')).toBeVisible();
    await templatesPage.formattingTab.click();
    await expect(templatesPage.registeredFields).toHaveText([...before, byButton, byEnter], { timeout: 15_000 });
  });

  test('An AI suggested field is registered when clicked, Remove takes a field out, and Approve & Save keeps both changes', async ({ page }) => {
    const { before } = await uploadAndOpenFormatting(page);
    const suggestion = templatesPage.suggestedFields.first();
    test.skip(!(await suggestion.waitFor({ timeout: 5_000 }).then(() => true, () => false)), 'the AI suggested no fields for this file');
    test.skip(before.length === 0, 'the AI registered no fields for this file, so there is none to remove');

    // --- A suggestion moves from AI Suggested Fields to the registered fields ---
    const suggested = (await suggestion.innerText()).replace(/^\+\s*/, '');  // "+ Address" → "Address"
    await suggestion.click();
    await expect(templatesPage.registeredField(suggested)).toBeVisible();
    await expect(templatesPage.suggestedFields.filter({ hasText: new RegExp(`^\\+ ${suggested}$`) })).toHaveCount(0);

    // --- Remove the first field the AI registered ---
    const [removed, ...kept] = before;
    await templatesPage.removeFieldButton(removed).click();
    await expect(templatesPage.registeredField(removed)).toHaveCount(0);
    await expect(templatesPage.registeredFields).toHaveText([...kept, suggested]);

    // --- Approve & Save, reload: both changes are kept ---
    await templatesPage.saveFormattingButton.click();
    await expect(templatesPage.formattingSaved).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await templatesPage.formattingTab.click();
    await expect(templatesPage.registeredFields).toHaveText([...kept, suggested], { timeout: 15_000 });
  });

  test('Upload two files at once (PDF and text): both are added as Document Draft drafts', async ({ page }) => {
    const stamp = newStamp();
    // "A" / "B": neither name is part of the other, so each row is found on its own
    const files = [testFile(`QA Template ${stamp} A`, 'pdf'), testFile(`QA Template ${stamp} B`, 'txt')];
    const uploadRequests = countRequests(page, 'POST', TEMPLATES);

    await templatesPage.uploadDocumentDraft(files);
    await expect(templatesPage.templatesAdded(2)).toBeVisible({ timeout: 15_000 });
    await expect(templatesPage.hiddenFromLawyers).toBeVisible();
    expect(uploadRequests(), 'each file should be uploaded once').toBe(2);

    await templatesPage.search(stamp);
    for (const file of files) {
      const row = templatesPage.row(file.name.replace(/\.\w+$/, ''));
      await expect(row, `${file.name} is not listed`).toContainText(file.name, { timeout: 15_000 });
      await expect(row.getByRole('cell', { name: 'Document Draft', exact: true })).toBeVisible();
      await expect(row.getByRole('cell', { name: 'Draft', exact: true })).toBeVisible();
    }
  });

  test('Upload the real document from TEST_FILE_PATH: the AI analyses it, and a custom field can be added', async ({ page }) => {
    // The file the main app's DocumentDraftsadd.spec.ts uploads; it is on the tester's machine, so skip without it
    const { name: fileName, ext } = path.parse(REAL_FILE);
    const extension = ext.toLowerCase();
    test.skip(!REAL_FILE || !fs.existsSync(REAL_FILE), 'TEST_FILE_PATH is not set in .env, or the file is not on this machine');
    test.skip(!MIME_TYPES[extension], `TEST_FILE_PATH is a "${extension}" file; Upload Document Draft takes PDF, DOC, DOCX or TXT`);
    test.setTimeout(720_000);  // a real document's AI analysis can take up to 10 minutes, as in the main app

    // --- Uploaded as "QA Template <timestamp> <file name>", so afterEach finds and deletes it ---
    const name = `QA Template ${newStamp()} ${fileName}`;
    await templatesPage.uploadDocumentDraft([{ name: `${name}${extension}`, mimeType: MIME_TYPES[extension], buffer: fs.readFileSync(REAL_FILE) }]);
    await expect(templatesPage.templateAdded).toBeVisible({ timeout: 30_000 });

    // --- Its page: the analysis finishes; the Formatting tab shows the blueprint and the fields the AI registered ---
    await templatesPage.search(name);
    await templatesPage.openTemplate(name);
    await waitUntilProfiled(page, 600_000);
    await templatesPage.formattingTab.click();
    await expect(templatesPage.blueprintHeading).toBeVisible({ timeout: 15_000 });
    await expect(templatesPage.registryHeading).toBeVisible();
    await expect(templatesPage.registeredCount).toBeVisible();
    const before = await templatesPage.registeredFields.allInnerTexts();
    await expect(templatesPage.registeredCount).toHaveText(`${before.length} registered`);

    // --- Add a custom field: it is listed after the AI's fields ---
    const field = `QA Field ${Date.now()}`;
    await templatesPage.addCustomField(field);
    await expect(templatesPage.registeredFields).toHaveText([...before, field]);
    await expect(templatesPage.registeredCount).toHaveText(`${before.length + 1} registered`);
  });

  test('Delete an uploaded Document Draft: it is removed from the list', async ({ page }) => {
    const name = `QA Template ${newStamp()}`;
    await templatesPage.uploadDocumentDraft([testFile(name, 'pdf')]);
    await expect(templatesPage.templateAdded).toBeVisible({ timeout: 15_000 });
    await templatesPage.search(name);
    await templatesPage.openTemplate(name);

    // --- Delete and confirm (Cancel in this dialog is tested in templates_action.spec.ts) ---
    const deleteRequests = countRequests(page, 'DELETE', TEMPLATE);
    await templatesPage.deleteTemplate();
    await expect(templatesPage.templateDeleted).toBeVisible({ timeout: 15_000 });
    expect(deleteRequests(), 'Delete should send one request').toBe(1);

    // --- Back on the list, the search no longer finds it ---
    await expect(page).toHaveURL(/\/templates$/);
    await templatesPage.search(name);
    await expect(templatesPage.noMatches).toBeVisible({ timeout: 15_000 });
  });
});

// ──────────────────────────────────────────────────────────────
// ❌  NEGATIVE SCENARIOS
// ──────────────────────────────────────────────────────────────
test.describe('Admin Document Drafts Add - Negative Scenarios', () => {
  test('A blank custom field, or one already registered (in any letter case), is not added', async ({ page }) => {
    const { before } = await uploadAndOpenFormatting(page);
    const field = `QA Field ${Date.now()}`;
    const updateRequests = countRequests(page, 'PATCH', TEMPLATE);

    for (const blank of ['', '   ']) {
      await templatesPage.addCustomField(blank);
      await expect(templatesPage.registeredFields, `the blank field "${blank}" was added`).toHaveText(before);
    }

    await templatesPage.addCustomField(field);
    await expect(templatesPage.registeredField(field)).toBeVisible();
    for (const duplicate of [field, field.toLowerCase(), field.toUpperCase()]) {
      await templatesPage.addCustomField(duplicate);
      await expect(templatesPage.registeredFields, `"${duplicate}" was added twice`).toHaveText([...before, field]);
    }
    await expect(templatesPage.registeredCount).toHaveText(`${before.length + 1} registered`);
    expect(updateRequests(), 'adding fields saved them before Approve & Save').toBe(0);
  });

  test('Field changes are lost on a reload without Approve & Save', async ({ page }) => {
    const { before } = await uploadAndOpenFormatting(page);
    const updateRequests = countRequests(page, 'PATCH', TEMPLATE);

    // --- Add a field and remove one, without saving ---
    await templatesPage.addCustomField(`QA Field ${Date.now()}`);
    if (before.length > 0) await templatesPage.removeFieldButton(before[0]).click();
    await expect(templatesPage.registeredFields).not.toHaveText(before);

    // --- After a reload the registry is as it was ---
    await page.reload();
    await templatesPage.formattingTab.click();
    await expect(templatesPage.registeredFields).toHaveText(before, { timeout: 15_000 });
    expect(updateRequests(), 'a change was saved without Approve & Save').toBe(0);
  });
});
