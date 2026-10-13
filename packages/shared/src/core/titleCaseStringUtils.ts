/** Title-case helpers for free-text fields and contact records. */

const LOWERCASE_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "but",
  "or",
  "for",
  "nor",
  "on",
  "at",
  "to",
  "by",
  "in",
  "of",
  "up",
  "as",
  "so",
  "yet",
]);

/**
 * Converts a string to Title Case, keeping minor words lowercase unless they are the first word.
 * @param value - The string to convert.
 * @returns The title-cased string, or the original value if it is not a string.
 */
export function toTitleCase(value: string): string;
export function toTitleCase(value: unknown): unknown;
export function toTitleCase(value: unknown): unknown {
  if (typeof value !== "string") return value;
  if (!value) return "";
  return value
    .trim()
    .split(/\s+/)
    .map((word, index) => {
      if (index === 0 || !LOWERCASE_WORDS.has(word.toLowerCase())) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      return word.toLowerCase();
    })
    .join(" ");
}

/**
 * Capitalize the first letter of a string token/word
 * @param value - The input string
 * @returns String with first letter uppercase
 */
export function capitalize(value: string): string {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}
