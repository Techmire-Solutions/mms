import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

/**
 * Toolbar count for the messaging Work directory: page rows vs total matches.
 *
 * The old label showed only `{count}` for the current page, so a 50-of-1,240
 * directory read like the whole result set.
 */
export function formatShownMessagesLabel(
  count: number,
  total: number,
  t: TranslationFunction,
): string {
  return t("messaging.shownCount", {
    count,
    total: Math.max(total, count),
  });
}
