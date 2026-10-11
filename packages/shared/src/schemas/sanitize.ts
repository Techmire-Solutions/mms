/**
 * Strips non-printable directional override runes (U+202A through U+202E, U+2066 through U+2069).
 * This prevents bidirectional text spoofing (RTLO attacks).
 */
export function sanitizeUnicode(value: string): string {
  if (typeof value !== "string") {
    return value;
  }
  return value.replace(/[\u202A-\u202E\u2066-\u2069]/g, "");
}

/**
 * Recursively traverses an object/array and applies sanitizeUnicode to all string values.
 * Useful for Zod preprocess steps to sanitize entire DTO payloads.
 */
export function deepSanitizeStrings(obj: unknown): unknown {
  if (typeof obj === "string") {
    return sanitizeUnicode(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(deepSanitizeStrings);
  }
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, deepSanitizeStrings(v)]));
  }
  return obj;
}
