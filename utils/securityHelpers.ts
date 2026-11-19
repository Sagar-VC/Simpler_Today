import { BrowserContext, Page } from '@playwright/test';

export interface CookieSecurityInfo {
  name: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: string;
}

/** Snapshot every cookie's security-relevant flags. Never returns cookie values. */
export async function getCookieReport(context: BrowserContext): Promise<CookieSecurityInfo[]> {
  const cookies = await context.cookies();
  return cookies.map(c => ({
    name: c.name,
    httpOnly: c.httpOnly,
    secure: c.secure,
    sameSite: c.sameSite,
  }));
}

export interface StorageKeyInfo {
  key: string;
  looksLikeToken: boolean;
}

const TOKEN_KEY_PATTERN = 'token|auth|jwt|session';
const JWT_VALUE_PATTERN = '^eyJ[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$';

/**
 * Snapshot localStorage/sessionStorage KEY NAMES and whether each entry's key or
 * value looks like a bearer token/JWT. Deliberately never returns the raw values —
 * this feeds a written report, not a debug dump.
 */
export async function getWebStorageSnapshot(
  page: Page
): Promise<{ localStorage: StorageKeyInfo[]; sessionStorage: StorageKeyInfo[] }> {
  return page.evaluate(
    ({ tokenKeyPattern, jwtValuePattern }) => {
      const keyRe = new RegExp(tokenKeyPattern, 'i');
      const valRe = new RegExp(jwtValuePattern);
      const scan = (storage: Storage) => {
        const results: { key: string; looksLikeToken: boolean }[] = [];
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i)!;
          const value = storage.getItem(key) ?? '';
          results.push({ key, looksLikeToken: keyRe.test(key) || valRe.test(value) });
        }
        return results;
      };
      return { localStorage: scan(window.localStorage), sessionStorage: scan(window.sessionStorage) };
    },
    { tokenKeyPattern: TOKEN_KEY_PATTERN, jwtValuePattern: JWT_VALUE_PATTERN }
  );
}

/** Case-insensitive header-name presence check against a Playwright response's headers map. */
export function hasSecurityHeader(headers: Record<string, string>, name: string): boolean {
  const target = name.toLowerCase();
  return Object.keys(headers).some(h => h.toLowerCase() === target);
}
