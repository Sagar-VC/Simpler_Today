import { test, expect } from '@playwright/test';
import path from 'path';
import { LoginPage } from '../pages/LoginPage';

declare const process: { env: { TEST_EMAIL?: string; TEST_PASSWORD?: string; TEST_FILE_PATH?: string } };

const EMAIL     = process.env.TEST_EMAIL     ?? '';
const PASSWORD  = process.env.TEST_PASSWORD  ?? '';
const FILE_PATH = process.env.TEST_FILE_PATH ?? '';

// Derive file name without extension (e.g. "Conversation.pdf" → "Conversation")
const FILE_NAME = path.basename(FILE_PATH, path.extname(FILE_PATH));

test('Verify Document Upload in Template Library', async ({ page }) => {
  test.setTimeout(180_000);

  const loginPage = new LoginPage(page);

  // Step 1: Log in with valid credentials
  await loginPage.goto();
  await loginPage.login(EMAIL, PASSWORD);
  await loginPage.skipTour();

  // Step 2 & 3: Click the Profile icon → navigate to Template Library
  await page.getByRole('button', { name: 'S', exact: true }).click();
  await page.getByRole('button', { name: 'Template Library' }).click();

  // Verify the Template Library page loaded
  await expect(page.getByRole('heading', { name: 'Template Library' })).toBeVisible();

  // Step 4: If the document already exists, delete it first so every run does a fresh upload
  const existingCard = page.locator(`p[title="${FILE_NAME}"]`);
  if (await existingCard.isVisible()) {
    // Document Drafts section → grid → individual card containing the specific title
    const draftCard = page.locator('section')
      .filter({ hasText: 'Document Drafts' })
      .locator('.grid > div')
      .filter({ has: page.locator(`p[title="${FILE_NAME}"]`) })
      .first();

    await draftCard.scrollIntoViewIfNeeded();
    await draftCard.hover();

    // The delete button has title="Delete template" — click it directly
    await draftCard.locator('button[title="Delete template"]').click();
    await page.getByRole('button', { name: /delete|confirm|yes/i }).last().click();
    await expect(existingCard).not.toBeVisible({ timeout: 10000 });
  }

  // Step 5: Verify the "Upload Document Draft" button is visible
  const uploadDraftBtn = page.getByRole('button', { name: /upload.*draft/i });
  await expect(uploadDraftBtn).toBeVisible();

  // Step 6: Click the button and upload the file
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    uploadDraftBtn.click(),
  ]);
  
  await fileChooser.setFiles(FILE_PATH);

  // Step 7 & 8: Verify the document card appears in the Document Drafts section
  await expect(page.locator(`p[title="${FILE_NAME}"]`)).toBeVisible({ timeout: 30000 });

  // Step 9: After upload the AI analysis runs automatically and the
  // "AI Drafting Blueprint & Variables Approval" popup auto-opens once done.
  // Wait up to 90 s for the popup heading to appear.
  await expect(
    page.getByRole('heading', { name: /AI Drafting Blueprint/i })
  ).toBeVisible({ timeout: 90000 });

  // Step 10: Verify the Interactive Variables Registry section is displayed
  const registryHeading = page.getByText('Interactive Variables Registry');
  await expect(registryHeading).toBeVisible();

  // Step 11: Scroll to the "ADD CUSTOM FIELD" input at the bottom of the registry
  const addCustomFieldInput = page.getByPlaceholder(/penalty rate|period|notice days/i);
  await addCustomFieldInput.scrollIntoViewIfNeeded();
  await expect(addCustomFieldInput).toBeVisible();

  // Step 12: Enter the new variable name
  const newVariable = 'Add new data 1';
  await addCustomFieldInput.fill(newVariable);

  // Step 13: Click the "+ Add" button (the "+" is an SVG icon; accessible name is just "Add")
  await page.locator('button').filter({ hasText: /^Add$/ }).click();

  // Step 14: Verify the new variable appears in the registry list
  await expect(page.getByText(newVariable, { exact: true })).toBeVisible({ timeout: 10000 });
});
