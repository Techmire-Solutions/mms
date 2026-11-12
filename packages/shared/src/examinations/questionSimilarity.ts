/**
 * @file questionSimilarity.ts
 * @description Deterministic near-duplicate scoring for Question Bank stems.
 *
 * Used by the authoring warning and the `check-duplicates` endpoint. The score is the Jaccard index
 * over character trigrams of a normalized stem: no randomness, no locale dependence, no ML, and the
 * same inputs always produce the same number.
 *
 * Normalization matters for this corpus: Arabic/Urdu diacritics and the kaf/yeh variants would
 * otherwise make two identical stems score far apart.
 */

/** Two stems at or above this score are treated as the same question for warning purposes. */
export const DUPLICATE_THRESHOLD = 0.82;

/** Lower bound for "similar enough to look at" (the endpoint returns these ranked). */
export const SIMILAR_THRESHOLD = 0.65;

/** Canonical form used for comparison: `ignore` is dropped/rewritten, punctuation becomes a space. */
export function normalizeQuestionText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[\u0640]/g, "")
    .replace(/[ىي]/g, "\u06CC")
    .replace(/[كک]/g, "\u06A9")
    .replace(/[أإآٱ]/g, "\u0627")
    .replace(/[ؤئ]/g, "\u0621")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function charTrigrams(value: string): Set<string> {
  if (!value) return new Set();
  const padded = ` ${value} `;
  const grams = new Set<string>();
  for (let index = 0; index + 3 <= padded.length; index += 1) {
    grams.add(padded.slice(index, index + 3));
  }
  return grams;
}

/** Jaccard similarity over character trigrams of the normalized stems, in `[0, 1]`. */
export function questionSimilarity(left: string, right: string): number {
  const leftGrams = charTrigrams(normalizeQuestionText(left));
  const rightGrams = charTrigrams(normalizeQuestionText(right));
  if (leftGrams.size === 0 || rightGrams.size === 0) return 0;

  let intersection = 0;
  for (const gram of leftGrams) {
    if (rightGrams.has(gram)) intersection += 1;
  }
  const union = leftGrams.size + rightGrams.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function isLikelyDuplicate(left: string, right: string): boolean {
  return questionSimilarity(left, right) >= DUPLICATE_THRESHOLD;
}

/** `true` when the stem is long enough for a similarity comparison to mean anything. */
export function hasComparableStem(text: string): boolean {
  return normalizeQuestionText(text).length >= 12;
}
