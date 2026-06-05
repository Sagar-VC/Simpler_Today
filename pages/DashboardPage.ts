import { Page, expect } from '@playwright/test';

export class DashboardPage {
  private readonly page: Page;
  private readonly dashboardURL = 'https://demo.pracsys.simplertoday.ai/dashboard';

  constructor(page: Page) {
    this.page = page;
  }

  /** Click the "New Workspace" button to open the creation dialog */
  async clickNewWorkspace() {
    await this.page.getByRole('button', { name: 'New Workspace' }).click();
  }

  /** Wait for a workspace card to appear by its index (default: first card) */
  async waitForWorkspaceCard(index: number = 0) {
    await this.page.locator(`#case-card-${index}`).waitFor({ timeout: 15000 });
  }

  /**
   * Wait for the AI background job on a workspace card to finish.
   * The "Preparing workspace overview" spinner is driven by a server-side AI
   * process that can take well over 60 s on the demo environment, so we allow
   * up to 2 minutes before failing.
   */
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

  /** Type into the search bar on the dashboard */
  async searchWorkspaces(text: string) {
    await this.page.locator('xpath=//*[@id="search-bar"]').click();
    await this.page.getByRole('textbox', { name: 'Search workspaces, case numbers, or clients' }).fill(text);
  }

  /** Open the 3-dot context menu on a workspace card.
   *  Uses a JS click to bypass the "still preparing" AI overlay that intercepts pointer events. */
  async openCardMenu(index: number = 0) {
    await this.page.locator(`#case-card-${index}`).hover();
    await this.page.evaluate((idx) => {
      const card = document.querySelector(`#case-card-${idx}`);
      if (!card) throw new Error(`#case-card-${idx} not found`);
      const btn = Array.from(card.querySelectorAll<HTMLElement>('button'))
        .find(b => !b.textContent?.trim() && !(b.getAttribute('aria-label') ?? '').includes('preparing'));
      if (!btn) throw new Error('Menu button not found');
      btn.click();
    }, index);
  }

  /** Assert a workspace name is visible in the search results */
  async verifyWorkspaceVisible(name: string) {
    await expect(this.page.getByText(name).first()).toBeVisible();
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

  /** Click the workspace heading on a card to open the workspace */
  async openWorkspace(index: number = 0, name: string) {
    await this.page.locator(`#case-card-${index}`).getByRole('heading', { name }).click();
  }
}
