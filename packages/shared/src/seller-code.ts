const SELLER_CODE_VALID_RE = /^[A-Z0-9]{4,20}$/;

/**
 * Normalizes a seller referral/promo code:
 * - trims outer whitespace
 * - collapses/strips internal spaces
 * - converts ASCII letters to uppercase
 */
export function normalizeSellerCode(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

export function isValidNormalizedSellerCode(normalized: string): boolean {
  return SELLER_CODE_VALID_RE.test(normalized);
}

export function parseAndNormalizeSellerCode(raw: string): {
  ok: true;
  normalized: string;
} | {
  ok: false;
  messageAr: string;
} {
  const normalized = normalizeSellerCode(raw);
  if (!isValidNormalizedSellerCode(normalized)) {
    return {
      ok: false,
      messageAr: 'كود البائع يجب أن يكون من 4 إلى 20 خانة من الحروف الإنجليزية الكبيرة والأرقام فقط',
    };
  }
  return { ok: true, normalized };
}

export function normalizeCouponCode(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}
