import type { GenericSavedReportCategory } from "@mms/shared";

/** Legacy localStorage collection that held generic saved-report presets. */
export const LEGACY_SAVED_REPORTS_COLLECTION_KEY = "reports_saved_reports";

/** Shape of a legacy browser-local saved-report preset. */
export interface LegacyLocalSavedReport {
  id: string;
  name: string;
  category: string;
  filters: Record<string, unknown>;
  lastRun: string;
  createdBy: string;
}

export interface LegacySavedReportsMigrationPlan {
  /** Valid same-category presets missing from the server — POST each once. */
  toImport: Array<{ id: string; name: string; filters: Record<string, unknown> }>;
  /** Valid same-category local ids to drop after a successful migration pass. */
  categoryIdsToRemove: string[];
  /** Local entries preserved on success (other categories + invalid records). */
  retainedLocalReports: unknown[];
}

/** Recursively sorts object keys so filter equivalence is order-independent. */
export function stableSerialize(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  const record = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    result[key] = canonicalize(record[key]);
  }
  return result;
}

/** True when name and filters match under stable serialization. */
export function reportsEquivalentByNameAndFilters(
  left: { name: string; filters: Record<string, unknown> },
  right: { name: string; filters: Record<string, unknown> },
): boolean {
  return (
    left.name === right.name && stableSerialize(left.filters) === stableSerialize(right.filters)
  );
}

export function isLegacyLocalSavedReport(value: unknown): value is LegacyLocalSavedReport {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    record.id.length > 0 &&
    typeof record.name === "string" &&
    record.name.length > 0 &&
    typeof record.category === "string" &&
    record.category.length > 0 &&
    record.filters !== null &&
    typeof record.filters === "object" &&
    !Array.isArray(record.filters) &&
    typeof record.lastRun === "string" &&
    typeof record.createdBy === "string"
  );
}

/**
 * Plans a one-time import of browser-local presets for a single category.
 * Deduplicates against server (and within local) by name + filters equivalence.
 */
export function planLegacySavedReportsMigration(args: {
  category: GenericSavedReportCategory;
  localReports: unknown[];
  serverReports: ReadonlyArray<{ name: string; filters: Record<string, unknown> }>;
}): LegacySavedReportsMigrationPlan {
  const { category, localReports, serverReports } = args;
  const toImport: LegacySavedReportsMigrationPlan["toImport"] = [];
  const categoryIdsToRemove: string[] = [];
  const retainedLocalReports: unknown[] = [];

  for (const entry of localReports) {
    if (!isLegacyLocalSavedReport(entry) || entry.category !== category) {
      retainedLocalReports.push(entry);
      continue;
    }

    categoryIdsToRemove.push(entry.id);

    const alreadyOnServer = serverReports.some((serverReport) =>
      reportsEquivalentByNameAndFilters(serverReport, entry),
    );
    if (alreadyOnServer) continue;

    const alreadyPlanned = toImport.some((planned) =>
      reportsEquivalentByNameAndFilters(planned, entry),
    );
    if (alreadyPlanned) continue;

    toImport.push({
      id: entry.id,
      name: entry.name,
      filters: entry.filters,
    });
  }

  return { toImport, categoryIdsToRemove, retainedLocalReports };
}

/** Drops successfully migrated category rows while preserving everything else. */
export function removeMigratedLocalReports(
  localReports: unknown[],
  categoryIdsToRemove: ReadonlyArray<string>,
): unknown[] {
  if (categoryIdsToRemove.length === 0) return localReports;
  const removeIds = new Set(categoryIdsToRemove);
  return localReports.filter((entry) => {
    if (!isLegacyLocalSavedReport(entry)) return true;
    return !removeIds.has(entry.id);
  });
}
