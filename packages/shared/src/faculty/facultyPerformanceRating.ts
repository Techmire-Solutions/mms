/** Inclusive bounds of a faculty performance rating (one decimal place). */
export const FACULTY_PERFORMANCE_RATING_MIN = 1;
export const FACULTY_PERFORMANCE_RATING_MAX = 5;

function isRatingValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Clamps `value` into the 1.0–5.0 range and rounds to one decimal place. */
export function clampFacultyPerformanceRating(value: number): number {
  const bounded = Math.min(
    FACULTY_PERFORMANCE_RATING_MAX,
    Math.max(FACULTY_PERFORMANCE_RATING_MIN, value),
  );
  return Math.round(bounded * 10) / 10;
}

/**
 * Average of evaluation ratings, clamped and rounded to one decimal.
 * Non-finite entries are ignored; returns `null` when no valid rating exists.
 */
export function computeFacultyPerformanceRating(
  ratings: ReadonlyArray<number | null | undefined>,
): number | null {
  const valid = ratings.filter(isRatingValue);
  if (valid.length === 0) return null;
  const sum = valid.reduce((total, rating) => total + rating, 0);
  return clampFacultyPerformanceRating(sum / valid.length);
}

/**
 * Parses a persisted decimal (`numeric(2,1)` arrives as a string) into a rating or `null`.
 * Out-of-range values are rejected rather than clamped so corrupt storage is visible.
 */
export function parseFacultyPerformanceRating(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) return null;
  if (parsed < FACULTY_PERFORMANCE_RATING_MIN || parsed > FACULTY_PERFORMANCE_RATING_MAX)
    return null;
  return Math.round(parsed * 10) / 10;
}

/** `"4.3 / 5"` display form; `fallback` when unrated. */
export function formatFacultyPerformanceRating(
  rating: number | null | undefined,
  fallback = "—",
): string {
  if (!isRatingValue(rating)) return fallback;
  return `${rating.toFixed(1)} / ${FACULTY_PERFORMANCE_RATING_MAX}`;
}
