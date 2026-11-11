import {
  buildCsvContent,
  buildExaminationsExportRows,
  resolveExaminationsExportColumns,
  type Exam,
  type ExaminationsExportColumn,
} from "@mms/shared";
import { getRequestTenant } from "../lib/tenantContext.js";
import { examinationsRepository } from "../examinations/repository/examinationsRepositoryAdapter.js";

/**
 * Examinations CSV export.
 *
 * The export route has always existed and gated on `hasBackgroundJobRunner("examinations:export")`,
 * but no runner or builder was ever registered — every export was a hard 503. This is the missing
 * server side: paged reads (never a full-table load) and the same column catalogue the route
 * accepts.
 *
 * Rows are exam records, not marks: the CSV import round-trips exam metadata, and marks leave the
 * system only through the marks API (tenant-scoped, permission-gated, audited).
 */

const PAGE_SIZE = 500;
/** Hard ceiling so a pathological tenant cannot buffer an unbounded artifact in the worker. */
const MAX_EXPORT_ROWS = 10_000;

export interface ExaminationsCsvExportOptions {
  columns?: unknown;
  filename?: string;
  viewerRole?: string;
  allowDeleted?: boolean;
}

export interface ExaminationsCsvExportResult {
  csv: string;
  filename: string;
  count: number;
}

function requireTenant(tenant?: string): string {
  const subdomain = (tenant ?? getRequestTenant())?.trim().toLowerCase();
  if (!subdomain) throw new Error("Tenant context required for an examinations export");
  return subdomain;
}

export async function buildExaminationsCsvExport(
  _query: Record<string, unknown>,
  options: ExaminationsCsvExportOptions,
  tenant?: string,
): Promise<ExaminationsCsvExportResult> {
  const subdomain = requireTenant(tenant);
  const columns = resolveExaminationsExportColumns(
    options.columns as ReadonlyArray<{ id?: string; label: string }> | undefined,
  ) as ExaminationsExportColumn[];

  const exams: Exam[] = [];
  for (let offset = 0; exams.length < MAX_EXPORT_ROWS; offset += PAGE_SIZE) {
    const page = await examinationsRepository.listExamsByWorkspace(subdomain, {
      limit: PAGE_SIZE,
      offset,
    });
    exams.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return {
    csv: buildCsvContent(buildExaminationsExportRows(exams, columns)),
    filename: options.filename?.trim() || "examinations.csv",
    count: exams.length,
  };
}
