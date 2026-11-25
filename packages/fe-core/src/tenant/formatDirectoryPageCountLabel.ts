import type { AppTranslationKey } from "@mms/contracts";

/**
 * Build a Work directory footer count label like `"24 faculty"` /
 * `"1 student"` — SSOT for the identical `N + singular|plural` computation
 * shared by person-directory cards and tables.
 */
export function formatDirectoryPageCountLabel(
  count: number,
  t: (key: AppTranslationKey, params?: Record<string, string | number>) => string,
  keys: { singular: AppTranslationKey; plural: AppTranslationKey },
): string {
  return `${count} ${t(count === 1 ? keys.singular : keys.plural)}`;
}
