import {
  ATTENDANCE_MODULE_MANIFEST,
  buildCsvContent,
  buildAttendanceExportRows,
  extractAttendanceCell,
  resolveAttendanceExportColumns,
  type AttendanceExportColumn,
  type AttendanceListQuery,
  type AttendanceRecord,
} from "@mms/shared";
import {
  createModuleExportService,
  type ModuleExportOptions,
  type ModuleExportQueryInput,
  type ModuleExportResult,
} from "../lib/createModuleExportService.js";
import { normalizeIncludeDeletedFlag } from "../lib/csvExportStreamFactory.js";
import { getRequestTenant } from "../lib/tenantContext.js";
import { attendanceRepository } from "../attendance/repository/attendanceRepositoryAdapter.js";

/**
 * Attendance CSV/JSON/XLSX export.
 *
 * The export route has always existed and enqueued `attendance:export`, but no runner or builder was
 * ever registered, so every export job dead-lettered after three attempts. This is the missing
 * server side: paged reads (never a full-table load), a fixed column catalog, and the same
 * `createModuleExportService` contract the other modules use.
 */

export type AttendanceExportQueryInput = ModuleExportQueryInput<AttendanceListQuery>;
export type AttendanceExportOptions = ModuleExportOptions<AttendanceExportColumn>;
export type AttendanceExportResult = ModuleExportResult;

function requireTenant(): string {
  const tenant = getRequestTenant()?.trim().toLowerCase();
  if (!tenant) throw new Error("Tenant context required for an attendance export");
  return tenant;
}

const attendanceExport = createModuleExportService<
  AttendanceRecord,
  AttendanceExportQueryInput,
  AttendanceExportColumn
>({
  manifest: ATTENDANCE_MODULE_MANIFEST,
  normalizeQuery: (query, allowDeleted) => ({
    ...query,
    includeDeleted: normalizeIncludeDeletedFlag(query.includeDeleted, allowDeleted),
  }),
  prepareExport: (options) => ({
    // The catalog is the allowlist: a client-supplied column outside it is dropped, never echoed.
    columns: resolveAttendanceExportColumns(options.columns),
    context: undefined,
  }),
  loadByIds: async (ids) => attendanceRepository.findAttendanceRecordsByIds(requireTenant(), ids),
  loadPage: async (query, page, limit, afterId) => {
    const result = await attendanceRepository.listAttendancePage(requireTenant(), {
      ...query,
      page,
      limit,
      skipCount: true,
      ...(afterId ? { afterId } : {}),
    } as AttendanceListQuery & { afterId?: string; skipCount?: boolean });
    return {
      rows: result.records,
      hasMore: result.hasMore,
      nextCursor: (result as { nextCursor?: string }).nextCursor,
    };
  },
  yieldDataChunks: (records, columns, chunkSize) => {
    function* gen(): Generator<string, void, undefined> {
      for (let index = 0; index < records.length; index += chunkSize) {
        const chunk = records.slice(index, index + chunkSize);
        const grid = buildAttendanceExportRows(chunk, columns);
        // The grid carries the header row first; the stream writes it once.
        const dataRows = grid.slice(1);
        if (dataRows.length > 0) yield `\n${buildCsvContent(dataRows)}`;
      }
    }
    return gen();
  },
  extractCell: extractAttendanceCell,
});

export const generateAttendanceCsvStreamChunks = attendanceExport.generateStreamChunks;
export const streamAttendanceCsvExport = attendanceExport.streamExport;
export const buildAttendanceCsvExport = attendanceExport.buildExport as (
  query: AttendanceExportQueryInput,
  options: AttendanceExportOptions,
) => Promise<AttendanceExportResult>;
