import { Page, Locator, expect } from '@playwright/test';

export class DashboardPage {
  private readonly page: Page;
  private readonly dashboardURL = 'https://demo.pracsys.simplertoday.ai/dashboard';

  // ── Locators ──────────────────────────────────────────────────────────────
  private readonly newWorkspaceBtn: Locator;
  private readonly searchBar:       Locator;

  constructor(page: Page) {
    this.page            = page;
    this.newWorkspaceBtn = page.getByRole('button', { name: 'New Workspace' });
    this.searchBar       = page.getByRole('textbox', { name: 'Search workspaces, case numbers, or clients' });
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  /** Click the "New Workspace" button to open the creation dialog */
  async clickNewWorkspace() {
    await this.newWorkspaceBtn.click();
  }

  /** Type into the search bar on the dashboard */
  async searchWorkspaces(text: string) {
    await this.page.locator('xpath=//*[@id="search-bar"]').click();
    await this.searchBar.fill(text);
  }

  /**
   * Open the 3-dot context menu on a workspace card.
   * Uses a JS click to bypass the "still preparing" AI overlay.
   */
  async openCardMenu(index: number = 0) {
    const cardLocator = this.page.locator(`#case-card-${index}`);
    await cardLocator.hover();
    await cardLocator.evaluate((card: any) => {
      const btn = Array.from(card.querySelectorAll('button')).find(
        (b: any) => !b.textContent?.trim() && !(b.getAttribute('aria-label') ?? '').includes('preparing')
      ) as any;
      if (!btn) throw new Error('Menu button not found');
      btn.click();
    });
  }

  /** Click the workspace heading on a card to open the workspace */
  async openWorkspace(index: number = 0, name: string) {
    await this.page.locator(`#case-card-${index}`).getByRole('heading', { name }).click();
  }

  // ── Assertions ────────────────────────────────────────────────────────────

  /** Wait for a workspace card to appear by its index */
  async waitForWorkspaceCard(index: number = 0) {
    await this.page.locator(`#case-card-${index}`).waitFor({ timeout: 15000 });
  }

  /** Wait for the AI background job on a workspace card to finish */
  async waitForWorkspaceReady(index: number = 0) {
    await expect(
      this.page.locator(`#case-card-${index}`).locator('button[aria-label*="still preparing"]')
    ).toBeHidden({ timeout: 240_000 });
  }

  /** Assert the workspace heading is visible on the given card */
  async verifyWorkspaceHeading(index: number = 0, name: string) {
    await expect(
      this.page.locator(`#case-card-${index}`).getByRole('heading', { name })
    ).toBeVisible({ timeout: 10000 });
  }

  /** Assert a workspace name is visible in the search results */
  async verifyWorkspaceVisible(name: string) {
    await expect(this.page.getByText(name).first()).toBeVisible({ timeout: 10000 });
  }

  /** Assert no workspace cards exist and the empty-state message is shown */
  async verifyNoWorkspaces() {
    await expect(this.page.locator('#case-card-0')).not.toBeVisible();
    await expect(this.page.getByText('No workspaces yet')).toBeVisible();
  }

  /** Assert the browser is on the dashboard URL */
  async verifyDashboardURL() {
    await expect(this.page).toHaveURL(this.dashboardURL, { timeout: 10000 });
  }
}
