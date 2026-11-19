import { Page, Locator, expect } from '@playwright/test';

/** The case's "Strategy & Objective" Intelligence Chat. */
export class CaseChatPage {
  private readonly page: Page;

  private readonly sectionLink: Locator;
  private readonly input:       Locator;

  constructor(page: Page) {
    this.page        = page;
    this.sectionLink = page.getByText('Strategy & Objective', { exact: true }).first();
    this.input       = page.getByPlaceholder(/^Ask about Strategy & Objective/);
  }

  /** Open the chat from the case sidebar. */
  async open() {
    await this.sectionLink.click();
    await expect(this.input).toBeVisible({ timeout: 15_000 });
  }

  /** Send a question to the AI. */
  async ask(question: string) {
    await this.input.fill(question);
    await this.input.press('Enter');
  }

  /** Chat paragraphs containing the given text (the question and any reply that echoes it). */
  messagesContaining(text: string): Locator {
    return this.page.locator('main p').filter({ hasText: text });
  }
}
