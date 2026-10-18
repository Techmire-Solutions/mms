import type { ModuleFieldDef } from "@mms/shared";
import { hasFieldValue } from "@mms/shared";

const DEFAULT_SKIP_TYPES = new Set(["boolean", "ai_summary"]);

export { hasFieldValue };

function ratio(filled: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((filled / total) * 100);
}

/**
 * Scores enabled registry fields against a draft record (0–100).
 */
export function calculateModuleFieldsCompleteness(
  draftRecord: Record<string, unknown>,
  orderedFields: readonly ModuleFieldDef[],
  fieldsConfig: Record<string, { enabled?: boolean } | undefined>,
  options?: {
    skipFieldIds?: ReadonlySet<string>;
    skipTypes?: ReadonlySet<string>;
    resolveValue?: (fieldId: string) => unknown;
  },
): number {
  const skipIds = options?.skipFieldIds ?? new Set<string>();
  const skipTypes = options?.skipTypes ?? DEFAULT_SKIP_TYPES;
  let total = 0;
  let filled = 0;

  for (const field of orderedFields) {
    if (skipIds.has(field.id)) continue;
    if (fieldsConfig[field.id]?.enabled === false) continue;
    if (field.type && skipTypes.has(field.type)) continue;
    total += 1;
    const value = options?.resolveValue ? options.resolveValue(field.id) : draftRecord[field.id];
    if (hasFieldValue(value)) filled += 1;
  }

  return ratio(filled, total);
}

/**
 * Scores explicit keyed units (e.g. contact pickers) against a draft record.
 */
export function calculateKeyedUnitsCompleteness(
  draftRecord: Record<string, unknown>,
  units: readonly { key: string; enabled?: boolean }[],
): number {
  let total = 0;
  let filled = 0;
  for (const unit of units) {
    if (unit.enabled === false) continue;
    total += 1;
    if (hasFieldValue(draftRecord[unit.key])) filled += 1;
  }
  return ratio(filled, total);
}
