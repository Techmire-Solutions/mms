import { LIST_PAGE_MAX_LIMIT } from "./apiSchemas.js";

/** Pagination result container metadata interface. */
export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Compares two objects by a target field property using locale-sensitive string comparison.
 * @param left First object to compare.
 * @param right Second object to compare.
 * @param field Field name or key to compare on.
 * @param dir Sorting direction ('asc' or 'desc').
 * @returns Numeric comparison result (-1, 0, or 1).
 */
export function compareByField<T>(
  left: T,
  right: T,
  field: keyof T | string,
  dir: "asc" | "desc" = "asc",
): number {
  const leftValue = (left as Record<string, unknown>)[field as string];
  const rightValue = (right as Record<string, unknown>)[field as string];
  const leftText = leftValue == null ? "" : String(leftValue);
  const rightText = rightValue == null ? "" : String(rightValue);
  const comparison = leftText.localeCompare(rightText, undefined, {
    numeric: true,
    sensitivity: "base",
  });
  return dir === "desc" ? -comparison : comparison;
}

/**
 * Paginates an in-memory array with bounds checking and metadata computation.
 * @param items Array of elements to paginate.
 * @param page Target page index (1-based, defaults to 1).
 * @param limit Maximum items per page (defaults to 50).
 * @param maxLimit Upper cap on limit to prevent memory spikes (defaults to 100).
 * @returns PageResult container with sliced items, total count, page, limit, and hasMore status.
 */
export function paginateArray<T>(
  items: T[],
  page = 1,
  limit = 50,
  maxLimit = LIST_PAGE_MAX_LIMIT,
): PageResult<T> {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), maxLimit);
  const total = items.length;
  const start = (safePage - 1) * safeLimit;
  const slice = items.slice(start, start + safeLimit);
  return {
    items: slice,
    total,
    page: safePage,
    limit: safeLimit,
    hasMore: start + slice.length < total,
  };
}

/**
 * Evaluates whether an unparsed query parameter value represents boolean true.
 * Recognizes boolean `true`, numeric `1`, and string `'true'`, `'1'`, `'yes'` (case/whitespace-insensitive).
 * @param value Raw unparsed query parameter value.
 * @returns True if value represents a truthy flag, false otherwise.
 */
export function isQueryFlagTrue(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    return trimmed === "true" || trimmed === "1" || trimmed === "yes";
  }
  return false;
}

/**
 * Normalizes and dedupes a collection of identifiers, trimming whitespace and dropping empties.
 * Accepts an array of ids, or a delimited string (e.g. comma-separated query param).
 * Avoids intermediate array allocations from repeated .map().filter() chaining.
 */
export function dedupeTrimmedIds(
  ids: string | readonly (string | number)[] | undefined | null,
  delimiter = ",",
): string[] {
  if (!ids) return [];
  const list = typeof ids === "string" ? ids.split(delimiter) : ids;
  if (list.length === 0) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < list.length; i++) {
    const raw = list[i];
    if (raw == null) continue;
    const trimmed = String(raw).trim();
    if (trimmed.length > 0 && !seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }
  return result;
}
