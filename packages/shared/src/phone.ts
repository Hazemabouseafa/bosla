const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_INDIC_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export function normalizeAsciiDigits(input: string): string {
  return input
    .split('')
    .map((ch) => {
      const arIdx = ARABIC_INDIC_DIGITS.indexOf(ch);
      if (arIdx !== -1) return String(arIdx);
      const faIdx = PERSIAN_INDIC_DIGITS.indexOf(ch);
      if (faIdx !== -1) return String(faIdx);
      return ch;
    })
    .join('');
}

const COUNTRY_DIAL_CODES: Record<string, string> = {
  EG: '+20',
  SA: '+966',
  AE: '+971',
  KW: '+965',
  QA: '+974',
  BH: '+973',
  OM: '+968',
  JO: '+962',
  LB: '+961',
  MA: '+212',
  TN: '+216',
  DZ: '+213',
  IQ: '+964',
  SD: '+249',
  YE: '+967',
  LY: '+218',
};

/**
 * Normalizes a mobile phone number (including Arabic-Indic numerals) into strict E.164 format.
 * Supports explicit `+CC...` or `00CC...`, or countryCode + local number (defaulting to Egypt `+20`).
 */
export function normalizePhoneToE164(
  rawPhone: string,
  countryCode = '+20',
): string | null {
  const ascii = normalizeAsciiDigits(rawPhone.trim());
  if (!ascii) return null;

  let cleaned = ascii.replace(/[\s\-().]/g, '');

  if (cleaned.startsWith('00')) {
    cleaned = '+' + cleaned.slice(2);
  }

  if (cleaned.startsWith('+')) {
    const digits = cleaned.slice(1).replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) return null;
    // Egypt normalization guard: +20010... -> +2010...
    if (digits.startsWith('200') && digits.length === 13) {
      return `+20${digits.slice(3)}`;
    }
    return `+${digits}`;
  }

  const dial = COUNTRY_DIAL_CODES[countryCode.toUpperCase()] ?? countryCode;
  const dialDigits = normalizeAsciiDigits(dial).replace(/\D/g, '');
  if (!dialDigits) return null;

  let localDigits = cleaned.replace(/\D/g, '');
  if (!localDigits) return null;

  // Strip national trunk leading 0 (e.g. Egyptian 01012345678 -> 1012345678)
  if (localDigits.startsWith('0')) {
    localDigits = localDigits.slice(1);
  }

  const full = `${dialDigits}${localDigits}`;
  if (full.length < 8 || full.length > 15) return null;

  // Egyptian mobile check when +20: 10xxxxxxxx, 11xxxxxxxx, 12xxxxxxxx, 15xxxxxxxx
  if (dialDigits === '20' && !/^201[0125]\d{8}$/.test(full)) {
    return null;
  }

  return `+${full}`;
}
