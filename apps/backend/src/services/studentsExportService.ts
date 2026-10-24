/**
 * @file studentsExportService.ts
 * @description Students module export service — wired to `createModuleExportService`.
 *
 * Uses the format-aware factory so JSON/XLSX exports are available alongside
 * the existing CSV streaming path.
 */
import {
  STUDENTS_MODULE_MANIFEST,
  buildCsvContent,
  buildStudentsExportRows,
  extractStudentCell,
  filterStudentExportColumnsForViewer,
  resolveAllStudentExportColumns,
  mergeCustomStudentExportColumns,
  type Student,
  type StudentExportColumn,
  type StudentsListQuery,
  type StudentsSettings,
} from "@mms/shared";
import {
  createModuleExportService,
  type ModuleExportQueryInput,
  type ModuleExportOptions,
  type ModuleExportResult,
} from "../lib/createModuleExportService.js";
import { normalizeIncludeDeletedFlag } from "../lib/csvExportStreamFactory.js";
import { loadStudentFieldConfig } from "../students/use-cases/studentConfigService.js";
import { loadStudentsByIds, loadStudentsPage } from "../students/use-cases/studentUseCases.js";

export type StudentsExportQueryInput = ModuleExportQueryInput<StudentsListQuery>;
export type StudentsCsvExportOptions = ModuleExportOptions<StudentExportColumn>;
export type StudentsCsvExportResult = ModuleExportResult;

async function prepareStudentsExport(
  options: StudentsCsvExportOptions,
): Promise<{ columns: StudentExportColumn[]; context: undefined }> {
  const settings = (await loadStudentFieldConfig()) as StudentsSettings | null;
  const requestedColumns =
    options.columns && options.columns.length > 0
      ? mergeCustomStudentExportColumns(options.columns, settings)
      : resolveAllStudentExportColumns(settings);
  const columns = filterStudentExportColumnsForViewer(
    requestedColumns,
    settings,
    options.viewerRole,
  );
  return { columns, context: undefined };
}

const studentsCsv = createModuleExportService<
  Student,
  StudentsExportQueryInput,
  StudentExportColumn
>({
  manifest: STUDENTS_MODULE_MANIFEST,
  normalizeQuery: (query, allowDeleted) => ({
    ...query,
    includeDeleted: normalizeIncludeDeletedFlag(query.includeDeleted, allowDeleted),
  }),
  prepareExport: prepareStudentsExport,
  loadByIds: loadStudentsByIds,
  loadPage: async (query, page, limit, afterId) => {
    const pageResult = await loadStudentsPage({
      ...query,
      page,
      limit,
      afterId,
      skipCount: true,
    } as never);
    return {
      rows: pageResult.students as Student[],
      hasMore: pageResult.hasMore,
      nextCursor: (pageResult as { nextCursor?: string }).nextCursor,
    };
  },
  yieldDataChunks: (students, columns, chunkSize) => {
    function* gen(): Generator<string, void, undefined> {
      for (let i = 0; i < students.length; i += chunkSize) {
        const chunk = students.slice(i, i + chunkSize);
        const chunkExportRows = buildStudentsExportRows(chunk, columns);
        const dataRows = chunkExportRows.slice(1);
        if (dataRows.length > 0) {
          yield "\n" + buildCsvContent(dataRows);
        }
      }
    }
    return gen();
  },
  // Enables JSON and XLSX export paths via createModuleExportService.buildExport
  extractCell: extractStudentCell,
});

export const generateStudentsCsvStreamChunks = studentsCsv.generateStreamChunks;
export const buildStudentsCsvExport = studentsCsv.buildExport as (
  query: StudentsExportQueryInput,
  options: StudentsCsvExportOptions,
) => Promise<StudentsCsvExportResult>;
