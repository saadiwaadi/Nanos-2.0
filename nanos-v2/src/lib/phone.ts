/**
 * Phone number normalization and search utility.
 * Handles Pakistani mobile phone numbers across diverse stored and entered formats:
 * - Local canonical: 03001234567 (11 digits, starts with 03)
 * - Country code: +92 300 1234567, 923001234567, 00923001234567
 * - Missing leading zero: 3001234567 (10 digits starting with 3)
 * - Formatted with punctuation: 0300-1234567, (0300) 123 4567, 0300.123.4567
 * - Partial searches (at least 4 digits): 0300123, 300123, +92300123
 */

/**
 * Normalizes a phone number to canonical Pakistani mobile format (03XXXXXXXXX).
 *
 * Rules:
 * 1. Strips spaces, dashes, brackets, dots, and other non-digit characters
 *    (keeps leading + only for country code detection, then removes it).
 * 2. Converts a leading 00 prefix to nothing (international dialling prefix).
 * 3. Converts a leading 92 country code to a local 0 prefix (e.g. 923001234567 -> 03001234567).
 * 4. Converts a leading 3 (10 digits, Pakistani mobile without the 0) to 03...
 * 5. Returns the canonical form 03XXXXXXXXX for Pakistani mobiles.
 * 6. Returns the digits-only string unchanged if it doesn't match a Pakistani mobile pattern,
 *    so partial searches and non-Pakistani numbers still work.
 */
export function normalizePhone(input: string): string {
  if (!input || typeof input !== "string") {
    return "";
  }

  const trimmed = input.trim();
  const hasLeadingPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");

  // International exit code 00
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  // Convert leading 92 country code to local 0 prefix
  // Cases: +92..., 923... (starts with mobile 3), or 12-digit 92...
  if (hasLeadingPlus && digits.startsWith("92")) {
    digits = "0" + digits.slice(2);
  } else if (digits.startsWith("923") && digits.length >= 3) {
    digits = "0" + digits.slice(2);
  } else if (digits.startsWith("92") && digits.length === 12) {
    digits = "0" + digits.slice(2);
  }

  // Convert leading 3 (10 digits, Pakistani mobile without the 0) to 03...
  if (digits.length === 10 && digits.startsWith("3")) {
    digits = "0" + digits;
  }

  // Canonical Pakistani mobile form: 03XXXXXXXXX (11 digits)
  if (/^03\d{9}$/.test(digits)) {
    return digits;
  }

  // Return digits-only string unchanged if it doesn't match full pattern (preserves partial searches)
  return digits;
}

/**
 * Matches a stored phone number against a user search query.
 *
 * Requirements:
 * - Normalizes the input with normalizePhone
 * - Also searches the raw input, so numbers stored in an unusual format still match
 * - Matches by partial number (contains) once input has at least 4 digits
 * - Handles un-normalized stored phone numbers matching clean queries, and vice versa
 */
export function matchPhone(
  storedPhone: string | null | undefined,
  query: string
): boolean {
  if (!storedPhone || !query) return false;

  const rawStored = storedPhone.trim();
  const rawQuery = query.trim();
  if (!rawStored || !rawQuery) return false;

  // 1. Direct raw substring match (case-insensitive) for unusual formats or notes
  if (rawStored.toLowerCase().includes(rawQuery.toLowerCase())) {
    return true;
  }

  const queryDigits = rawQuery.replace(/\D/g, "");
  // Require at least 4 digits for partial numeric matching
  if (queryDigits.length < 4) {
    return false;
  }

  const storedDigits = rawStored.replace(/\D/g, "");
  const normStored = normalizePhone(rawStored);
  const normQuery = normalizePhone(rawQuery);

  // 2. Normalized matches (canonical or normalized partial)
  if (normStored && normQuery) {
    if (normStored.includes(normQuery)) return true;
    if (normQuery.includes(normStored)) return true;
  }

  // 3. Digits-only partial contains
  if (storedDigits && queryDigits) {
    if (storedDigits.includes(queryDigits)) return true;
  }
  if (normStored && queryDigits) {
    if (normStored.includes(queryDigits)) return true;
  }
  if (storedDigits && normQuery) {
    if (storedDigits.includes(normQuery)) return true;
  }

  // 4. Core number match (without leading 0 or country code)
  // E.g. query "300123" matching stored "03001234567"
  const storedCore = normStored.startsWith("03") ? normStored.slice(1) : storedDigits;
  const queryCore = normQuery.startsWith("03") ? normQuery.slice(1) : queryDigits;
  if (storedCore.length >= 4 && queryCore.length >= 4) {
    if (storedCore.includes(queryCore)) return true;
  }

  return false;
}

/**
 * Generates search variants for phone numbers to be used in Prisma OR queries
 * across the Order.shippingInfo TEXT column.
 */
export function getPhoneSearchVariants(query: string): string[] {
  if (!query || typeof query !== "string") return [];
  const raw = query.trim();
  if (!raw) return [];

  const variants = new Set<string>();
  const digits = raw.replace(/\D/g, "");

  if (raw.length >= 3) {
    variants.add(raw);
  }

  // Only generate phone variants if we have at least 4 digits
  if (digits.length >= 4) {
    variants.add(digits);

    const norm = normalizePhone(raw);
    if (norm) {
      variants.add(norm);

      if (norm.startsWith("03")) {
        const withoutZero = norm.slice(1);
        variants.add(withoutZero);
        variants.add(`92${withoutZero}`);
        variants.add(`+92${withoutZero}`);
        variants.add(`+92 ${withoutZero}`);

        if (norm.length === 11) {
          variants.add(`${norm.slice(0, 4)} ${norm.slice(4)}`);
          variants.add(`${norm.slice(0, 4)}-${norm.slice(4)}`);
          variants.add(`+92 ${norm.slice(1, 4)} ${norm.slice(4)}`);
        }
      }
    }
  }

  return Array.from(variants);
}
