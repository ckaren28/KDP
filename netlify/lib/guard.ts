// Shared checks for the functions that spend money (every call to the Claude
// API is billed to Karen's key) or check the gate password.
//
// Lives outside netlify/functions/ on purpose: every file in that folder is
// deployed as its own endpoint.
//
// The origin check stops a script, or another site, from calling these
// endpoints directly. It is not a lock, since a determined caller can forge
// the header, which is why the Anthropic spend limit is the real backstop.
// What it does stop is the cheap, common case.

type Headers = Record<string, string | undefined>;

const ALLOWED_HOSTS = new Set(['karendettmar.com', 'www.karendettmar.com', 'localhost', '127.0.0.1']);

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try { return new URL(url).hostname; } catch { return null; }
}

function allowedHost(host: string | null): boolean {
  if (!host) return false;
  // Deploy previews and branch deploys of this site.
  return ALLOWED_HOSTS.has(host) || host.endsWith('--kdettmar-studio.netlify.app') || host === 'kdettmar-studio.netlify.app';
}

/** True when the request came from a page on this site. Browsers send Origin
 *  on every POST from fetch; Referer is the fallback. */
export function fromThisSite(headers: Headers = {}): boolean {
  return allowedHost(hostOf(headers.origin)) || allowedHost(hostOf(headers.referer));
}

/** Refuses anything oversized before it is parsed. The largest real request is
 *  a garment photo, capped at its own limit inside the decoder. */
export function bodyTooLarge(body: string | null, maxBytes: number): boolean {
  return (body?.length ?? 0) > maxBytes;
}

export const FORBIDDEN = {
  statusCode: 403,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  body: JSON.stringify({ error: 'Requests are only accepted from karendettmar.com.' }),
};

export const TOO_LARGE = {
  statusCode: 413,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  body: JSON.stringify({ error: 'That request is too large.' }),
};
