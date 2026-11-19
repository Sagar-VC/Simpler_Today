import { Page } from '@playwright/test';

/**
 * Count the requests a page sends to an endpoint, from now on.
 * Used to prove a form or dialog was (or was not) submitted, e.g. that Cancel sent nothing.
 */
export function countRequests(page: Page, method: string, path: RegExp): () => number {
  let count = 0;
  page.on('request', req => {
    if (req.method() === method && path.test(new URL(req.url()).pathname)) count++;
  });
  return () => count;
}
