import type { AppTranslationKey } from "@mms/shared";
import type { ReportCollection } from "./reportCollectionTypes.js";

export interface VisualizerConfig {
  id: string;
  title: string;
  collection: ReportCollection;
  chartType: "bar" | "line" | "area" | "pie" | "radar";
  xAxisField: string;
  operation: "count" | "sum" | "avg" | "min" | "max";
  targetField?: string;
  activePalette?: string;
}

/**
 * Safely translates a field value to its user-friendly label, falling back to a default label.
 *
 * @param fieldValue The field identifier string.
 * @param defaultLabel The default label if translation is missing.
 * @param t The active translation function.
 */
export function getFieldLabel(
  fieldValue: string,
  defaultLabel: string,
  t: (key: AppTranslationKey, params?: Record<string, string | number>) => string,
): string {
  const transKey = `reports.fields.${fieldValue}`;
  const translated = t(transKey as AppTranslationKey);
  return translated === transKey ? defaultLabel : translated;
}

/**
 * Safely translates a collection key to its user-friendly name, falling back to a default label.
 *
 * @param collectionValue The collection identifier string.
 * @param defaultLabel The default name if translation is missing.
 * @param t The active translation function.
 */
export function getCollectionLabel(
  collectionValue: string,
  defaultLabel: string,
  t: (key: AppTranslationKey, params?: Record<string, string | number>) => string,
): string {
  const transKey = `reports.collections.${collectionValue}`;
  const translated = t(transKey as AppTranslationKey);
  return translated === transKey ? defaultLabel : translated;
}
