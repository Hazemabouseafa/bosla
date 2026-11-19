const ARABIC_TO_LATIN: Record<string, string> = {
  أ: 'a',
  إ: 'a',
  آ: 'a',
  ا: 'a',
  ب: 'b',
  ت: 't',
  ث: 'th',
  ج: 'g',
  ح: 'h',
  خ: 'kh',
  د: 'd',
  ذ: 'dh',
  ر: 'r',
  ز: 'z',
  س: 's',
  ش: 'sh',
  ص: 's',
  ض: 'd',
  ط: 't',
  ظ: 'z',
  ع: 'a',
  غ: 'gh',
  ف: 'f',
  ق: 'q',
  ك: 'k',
  ل: 'l',
  م: 'm',
  ن: 'n',
  ه: 'h',
  ة: 'h',
  و: 'w',
  ي: 'y',
  ى: 'a',
  ئ: 'y',
  ؤ: 'w',
  ء: '',
};

/**
 * Generates a URL-safe `[a-z0-9-]+` slug from Arabic or English titles.
 * Guarantees length >= 3 so schema regex validation always succeeds seamlessly.
 */
export function slugifyTitle(title: string, fallbackPrefix = 'item'): string {
  const raw = (title || '').trim().toLowerCase();
  let transliterated = '';
  for (const ch of raw) {
    if (ARABIC_TO_LATIN[ch] !== undefined) {
      transliterated += ARABIC_TO_LATIN[ch];
    } else if (/[\u064b-\u065f\u0670]/.test(ch)) {
      // Strip Arabic diacritics
    } else if (/[a-z0-9]/.test(ch)) {
      transliterated += ch;
    } else if (/[\s_\-/.,|]+/.test(ch)) {
      transliterated += '-';
    }
  }

  const cleaned = transliterated
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
    .replace(/-$/g, '');

  if (cleaned.length >= 3) {
    return cleaned;
  }

  const suffix = Math.random().toString(36).slice(2, 6);
  return `${fallbackPrefix}-${suffix}`;
}
