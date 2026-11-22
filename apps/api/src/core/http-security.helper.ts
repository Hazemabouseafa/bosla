import type { Request } from 'express';

/**
 * Determines whether a request arrived over HTTPS, honoring `COOKIE_SECURE`
 * (`true`/`1`/`false`/`0`/`auto`) and reverse-proxy headers (`x-forwarded-proto`, `origin`, `referer`).
 */
export function isRequestHttps(req: Request): boolean {
  const mode = (process.env.COOKIE_SECURE || 'auto').trim().toLowerCase();
  if (mode === 'true' || mode === '1') return true;
  if (mode === 'false' || mode === '0') return false;

  const xfProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  if (xfProto === 'https') return true;
  if (xfProto === 'http') return false;

  const origin = String(req.headers.origin || req.headers.referer || '').toLowerCase();
  if (origin.startsWith('https://')) return true;
  if (origin.startsWith('http://')) return false;

  return Boolean(req.secure);
}
