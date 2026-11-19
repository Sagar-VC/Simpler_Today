/**
 * Expiry time (ms) of a signed storage link — V2 (`Expires`) or V4 (`X-Goog-Date` + `X-Goog-Expires`).
 * Returns null when the link is missing or not signed.
 */
export function signedLinkExpiry(url: string | undefined): number | null {
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
