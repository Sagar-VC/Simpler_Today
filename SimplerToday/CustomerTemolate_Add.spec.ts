import { test, Page } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { CustomTemplatePage } from '../pages/CustomTemplatePage';

const EMAIL    = process.env.TEST_EMAIL    ?? '';
const PASSWORD = process.env.TEST_PASSWORD ?? '';

// Shared setup: login and open the Template Library
async function setup(page: Page): Promise<CustomTemplatePage> {
  const loginPage = new LoginPage(page);
  const tp        = new CustomTemplatePage(page);

  await loginPage.goto();
  await loginPage.login(EMAIL, PASSWORD);
  await loginPage.skipTour();

  await tp.open();
  await tp.verifyPageLoaded();
  await tp.backToDashboard();

  return tp;
}

// Shared flow: open dialog → select type → save → rename → search → verify
async function createAndVerify(
  tp: Page,
  selectType: (t: CustomTemplatePage) => Promise<void>,
  name: string,
  saveOverride?: (t: CustomTemplatePage) => Promise<void>,
) {
  const templatePage = new CustomTemplatePage(tp);

  await templatePage.open();
  await templatePage.clickCreateCustom();
  await selectType(templatePage);
  if (saveOverride) {
    await saveOverride(templatePage);
  } else {
    await templatePage.clickSaveChanges();
  }

  await templatePage.backToDashboard();
  await templatePage.open();
  await templatePage.editFirstResult(name);

  await templatePage.search(name);
  await templatePage.verifyFileVisible(name);
  await templatePage.clearSearch();
  await templatePage.verifyFileVisible(name);
}

// ──────────────────────────────────────────────────────────────────────────────
test.describe('Template Creation - All Types', () => {

  test('01 - Create Letterheads Template', async ({ page }) => {
    test.setTimeout(120_000);
    await setup(page);
    const name = `Letterheads Template ${Date.now()}`;
    await createAndVerify(
      page,
      t => t.selectLetterheads(),
      name,
      t => t.saveLetterhead(),           // Letterheads editor uses "Save Letterhead"
    );
  });

  test('02 - Create Supreme Court of India Template', async ({ page }) => {
    test.setTimeout(120_000);
    await setup(page);
    const name = `Supreme Court Template ${Date.now()}`;
    await createAndVerify(page, t => t.selectSupremeCourtOfIndia(), name);
  });

  test('03 - Create High Courts of India Template', async ({ page }) => {
    test.setTimeout(120_000);
    await setup(page);
    const name = `High Courts Template ${Date.now()}`;
    await createAndVerify(
      page,
      async t => {
        await t.selectHighCourtsOfIndia();
        await t.selectHighCourtState('Delhi');  // sub-dialog: pick a state geography
      },
      name,
    );
  });

  test('04 - Create District Courts of India Template', async ({ page }) => {
    test.setTimeout(120_000);
    await setup(page);
    const name = `District Courts Template ${Date.now()}`;
    await createAndVerify(page, t => t.selectDistrictCourtsOfIndia(), name);
  });

  test('05 - Create Tribunals & Forums Template', async ({ page }) => {
    test.setTimeout(120_000);
    await setup(page);
    const name = `Tribunals Forums Template ${Date.now()}`;
    await createAndVerify(page, t => t.selectTribunalsAndForums(), name);
  });

  test('06 - Create Custom Template', async ({ page }) => {
    test.setTimeout(120_000);
    await setup(page);
    const name = `Custom Template ${Date.now()}`;
    await createAndVerify(page, t => t.clickCreateCustomTemplate(), name);
  });

});
