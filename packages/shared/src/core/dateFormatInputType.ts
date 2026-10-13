import { normalizeDateFormat } from "./dateFormatPresets.js";

/**
 * Auto-formats a date input string as the user types, automatically inserting
 * separators ('/' or preset separator) between numbers.
 *
 * @param input - The raw text from the input field
 * @param formatId - The target DateFormatId (e.g. 'DD/MM/YYYY', 'YYYY-MM-DD', etc.)
 * @param previousValue - The previous input string (used to detect backspacing)
 */
export function formatDateInputAsYouType(
  input: string | null | undefined,
  formatId: string,
  previousValue = "",
): string {
  if (!input || !input.trim()) return "";

  const id = normalizeDateFormat(formatId);
  const sep = id.includes("/") ? "/" : id.includes(".") ? "." : "-";
  const isYearFirst = id.startsWith("YYYY");
  const maxLens = isYearFirst ? [4, 2, 2] : [2, 2, 4];
  const maxDigits = maxLens[0] + maxLens[1] + maxLens[2];

  const isDeleting = previousValue.length > input.length;

  // Normalize all separators to the target preset separator
  const normalized = input.replace(/[/\-.]/g, sep);

  // If user is deleting and the deleted character was a trailing separator,
  // do not re-add the separator.
  if (isDeleting && previousValue.endsWith(sep) && normalized === previousValue.slice(0, -1)) {
    return normalized;
  }

  // If the input already contains separators
  if (normalized.includes(sep)) {
    const rawSegments = normalized.split(sep);
    const cleanedSegments: string[] = [];

    const effectiveMaxLens = rawSegments.length === 2 && !isYearFirst ? [2, 4] : maxLens;

    for (let i = 0; i < Math.min(rawSegments.length, 3); i++) {
      const maxLen = effectiveMaxLens[i]!;
      const digits = (rawSegments[i] || "").replace(/\D/g, "").slice(0, maxLen);
      cleanedSegments.push(digits);
    }

    if (cleanedSegments.length === 1) {
      const seg0 = cleanedSegments[0]!;
      if (!isDeleting && seg0.length === maxLens[0]) {
        return `${seg0}${sep}`;
      }
      return seg0;
    }

    if (cleanedSegments.length === 2) {
      const [seg0, seg1] = cleanedSegments as [string, string];
      if (!isDeleting && seg1.length === maxLens[1]) {
        return `${seg0}${sep}${seg1}${sep}`;
      }
      if (normalized.endsWith(sep) && !seg1) {
        return `${seg0}${sep}`;
      }
      return `${seg0}${sep}${seg1}`;
    }

    if (cleanedSegments.length >= 3) {
      const [seg0, seg1, seg2] = cleanedSegments as [string, string, string];
      if (normalized.endsWith(sep) && !seg2) {
        return `${seg0}${sep}${seg1}${sep}`;
      }
      return `${seg0}${sep}${seg1}${sep}${seg2}`;
    }
  }

  // Input does NOT contain separators: format purely by digits
  const digits = input.replace(/\D/g, "").slice(0, maxDigits);
  if (!digits) return "";

  if (isYearFirst) {
    if (digits.length < 4) {
      return digits;
    }
    if (digits.length === 4) {
      return isDeleting ? digits : `${digits}${sep}`;
    }
    if (digits.length < 6) {
      return `${digits.slice(0, 4)}${sep}${digits.slice(4)}`;
    }
    if (digits.length === 6) {
      return isDeleting
        ? `${digits.slice(0, 4)}${sep}${digits.slice(4)}`
        : `${digits.slice(0, 4)}${sep}${digits.slice(4)}${sep}`;
    }
    return `${digits.slice(0, 4)}${sep}${digits.slice(4, 6)}${sep}${digits.slice(6, 8)}`;
  }

  if (digits.length < 2) {
    return digits;
  }
  if (digits.length === 2) {
    return isDeleting ? digits : `${digits}${sep}`;
  }
  if (digits.length < 4) {
    return `${digits.slice(0, 2)}${sep}${digits.slice(2)}`;
  }
  if (digits.length === 4) {
    // If the 4 digits form a 4-digit year (1900-2099), keep as 4 digits
    const num = Number(digits);
    if (num >= 1900 && num <= 2099) {
      return digits;
    }
    return isDeleting
      ? `${digits.slice(0, 2)}${sep}${digits.slice(2)}`
      : `${digits.slice(0, 2)}${sep}${digits.slice(2)}${sep}`;
  }
  return `${digits.slice(0, 2)}${sep}${digits.slice(2, 4)}${sep}${digits.slice(4, 8)}`;
}
