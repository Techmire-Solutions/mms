import { desc, eq } from "drizzle-orm";
import type { GenericSavedReport } from "@mms/shared";
import { savedReports } from "../schema.js";
import { withTenant } from "../tenant-context.js";

export const SAVED_REPORT_SELECT_FIELDS = {
  id: savedReports.id,
  name: savedReports.name,
  category: savedReports.category,
  filters: savedReports.filters,
  lastRunAt: savedReports.lastRunAt,
  createdBy: savedReports.createdBy,
  createdByName: savedReports.createdByName,
  createdAt: savedReports.createdAt,
};

export type SavedReportRow = Pick<
  typeof savedReports.$inferSelect,
  "id" | "name" | "category" | "filters" | "lastRunAt" | "createdBy" | "createdByName" | "createdAt"
>;

export function toGenericSavedReport(row: SavedReportRow): GenericSavedReport {
  const lastRunIso =
    row.lastRunAt instanceof Date
      ? row.lastRunAt.toISOString()
      : row.lastRunAt
        ? String(row.lastRunAt)
        : row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : new Date().toISOString();

  const createdAtIso =
    row.createdAt instanceof Date
      ? row.createdAt.toISOString()
      : row.createdAt
        ? String(row.createdAt)
        : new Date().toISOString();

  return {
    id: row.id,
    name: row.name,
    category: row.category as GenericSavedReport["category"],
    filters:
      row.filters && typeof row.filters === "object" && !Array.isArray(row.filters)
        ? (row.filters as Record<string, unknown>)
        : {},
    lastRun: lastRunIso,
    createdBy: row.createdBy,
    createdByName: row.createdByName ?? "",
    createdAt: createdAtIso,
  };
}

/** Every saved-report preset for a workspace — admin backup snapshots. */
export async function listAllSavedReportsByWorkspace(
  workspaceSubdomain: string,
  options?: { limit?: number; offset?: number; unbounded?: boolean },
): Promise<GenericSavedReport[]> {
  const tenant = workspaceSubdomain.trim().toLowerCase();
  const limit = options?.unbounded ? undefined : Math.min(Math.max(1, options?.limit ?? 500), 5000);
  const offset = Math.max(0, options?.offset ?? 0);
  return withTenant(tenant, async (tx) => {
    const baseQuery = tx
      .select(SAVED_REPORT_SELECT_FIELDS)
      .from(savedReports)
      .where(eq(savedReports.workspaceSubdomain, tenant))
      .orderBy(desc(savedReports.createdAt))
      .offset(offset);
    const rows = limit ? await baseQuery.limit(limit) : await baseQuery;
    return rows.map(toGenericSavedReport);
  });
}

/** Wipe+replace saved-report presets — admin restore only. */
export async function replaceSavedReportsForWorkspace(
  workspaceSubdomain: string,
  reports: GenericSavedReport[],
): Promise<void> {
  const tenant = workspaceSubdomain.trim().toLowerCase();
  await withTenant(tenant, async (tx) => {
    await tx.delete(savedReports).where(eq(savedReports.workspaceSubdomain, tenant));
    if (reports.length === 0) return;

    const seen = new Set<string>();
    const values = [];
    for (const report of reports) {
      const id = String(report.id);
      if (seen.has(id)) continue;
      seen.add(id);
      const lastRunAt = new Date(report.lastRun);
      const createdAt = new Date(report.createdAt);
      values.push({
        id,
        workspaceSubdomain: tenant,
        category: report.category,
        name: report.name,
        filters: report.filters,
        lastRunAt: Number.isNaN(lastRunAt.getTime()) ? new Date() : lastRunAt,
        createdBy: report.createdBy,
        createdByName: report.createdByName,
        createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
        updatedAt: new Date(),
      });
    }
    if (values.length > 0) {
      await tx.insert(savedReports).values(values);
    }
  });
}
