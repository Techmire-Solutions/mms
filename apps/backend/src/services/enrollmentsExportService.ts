import {
  ENROLLMENTS_MODULE_MANIFEST,
  buildCsvContent,
  buildEnrollmentsExportRows,
  extractEnrollmentCell,
  filterEnrollmentExportColumnsForViewer,
  resolveAllEnrollmentExportColumns,
  type Enrollment,
  type EnrollmentExportColumn,
  type EnrollmentsListQuery,
} from "@mms/shared";
import {
  createModuleExportService,
  type ModuleExportQueryInput,
  type ModuleExportOptions,
  type ModuleExportResult,
} from "../lib/createModuleExportService.js";
import { normalizeIncludeDeletedFlag } from "../lib/csvExportStreamFactory.js";
import { loadEnrollmentsByIds, loadEnrollmentsPage } from "./enrollmentService.js";

export type EnrollmentsExportQueryInput = ModuleExportQueryInput<EnrollmentsListQuery>;
export type EnrollmentsExportOptions = ModuleExportOptions<EnrollmentExportColumn>;
export type EnrollmentsExportResult = ModuleExportResult;
export type EnrollmentsCsvExportOptions = EnrollmentsExportOptions;
export type EnrollmentsCsvExportResult = EnrollmentsExportResult;

async function prepareEnrollmentsExport(
  options: EnrollmentsExportOptions,
): Promise<{ columns: EnrollmentExportColumn[]; context: undefined }> {
  const requestedColumns =
    options.columns && options.columns.length > 0
      ? options.columns
      : resolveAllEnrollmentExportColumns();
  const columns = filterEnrollmentExportColumnsForViewer(requestedColumns);
  return { columns, context: undefined };
}

const enrollmentsCsv = createModuleExportService<
  Enrollment,
  EnrollmentsExportQueryInput,
  EnrollmentExportColumn
>({
  manifest: ENROLLMENTS_MODULE_MANIFEST,
  normalizeQuery: (query, allowDeleted) => ({
    ...query,
    includeDeleted: normalizeIncludeDeletedFlag(query.includeDeleted, allowDeleted),
  }),
  prepareExport: prepareEnrollmentsExport,
  loadByIds: (ids) => loadEnrollmentsByIds(ids) as Promise<Enrollment[]>,
  loadPage: async (query, page, limit, afterId) => {
    const pageResult = await loadEnrollmentsPage({
      ...query,
      page,
      limit,
      afterId,
      skipCount: true,
    } as never);
    return {
      rows: pageResult.enrollments as Enrollment[],
      hasMore: pageResult.hasMore,
      nextCursor: (pageResult as { nextCursor?: string }).nextCursor,
    };
  },
  yieldDataChunks: (enrollments, columns, chunkSize) => {
    function* gen(): Generator<string, void, undefined> {
      for (let i = 0; i < enrollments.length; i += chunkSize) {
        const chunk = enrollments.slice(i, i + chunkSize);
        const chunkExportRows = buildEnrollmentsExportRows(chunk, columns);
        const dataRows = chunkExportRows.slice(1);
        if (dataRows.length > 0) {
          yield "\n" + buildCsvContent(dataRows);
        }
      }
    }
    return gen();
  },
  extractCell: extractEnrollmentCell,
});

export const generateEnrollmentsCsvStreamChunks = enrollmentsCsv.generateStreamChunks;
export const streamEnrollmentsCsvExport = enrollmentsCsv.streamExport;
export const buildEnrollmentsCsvExport = enrollmentsCsv.buildExport as (
  query: EnrollmentsExportQueryInput,
  options: EnrollmentsExportOptions,
) => Promise<EnrollmentsExportResult>;
