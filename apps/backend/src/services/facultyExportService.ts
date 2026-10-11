import {
  FACULTY_MODULE_MANIFEST,
  buildCsvContent,
  buildFacultyExportRows,
  createFacultyCellExtractor,
  filterFacultyExportColumnsForViewer,
  resolveAllFacultyExportColumns,
  mergeCustomFacultyExportColumns,
  type Faculty,
  type FacultyExportColumn,
  type FacultyListQuery,
  type FacultySettings,
} from "@mms/shared";
import {
  createModuleExportService,
  type ModuleExportQueryInput,
  type ModuleExportOptions,
  type ModuleExportResult,
} from "../lib/createModuleExportService.js";
import { normalizeIncludeDeletedFlag } from "../lib/csvExportStreamFactory.js";
import { loadFacultyFieldConfig } from "./facultyConfigService.js";
import { loadFacultyByIds, loadFacultyPage } from "./facultyService.js";

export type FacultyExportQueryInput = ModuleExportQueryInput<FacultyListQuery>;
export type FacultyExportOptions = ModuleExportOptions<FacultyExportColumn>;
export type FacultyExportResult = ModuleExportResult;
export type FacultyCsvExportOptions = FacultyExportOptions;
export type FacultyCsvExportResult = FacultyExportResult;

type FacultyExportContext = { settings: FacultySettings | null };

async function prepareFacultyExport(
  options: FacultyExportOptions,
): Promise<{ columns: FacultyExportColumn[]; context: FacultyExportContext }> {
  const settings = (await loadFacultyFieldConfig()) as FacultySettings | null;
  const requestedColumns =
    options.columns && options.columns.length > 0
      ? mergeCustomFacultyExportColumns(options.columns, settings)
      : resolveAllFacultyExportColumns(settings);
  const columns = filterFacultyExportColumnsForViewer(
    requestedColumns,
    settings,
    options.viewerRole,
  );
  return { columns, context: { settings } };
}

const facultyCsv = createModuleExportService<
  Faculty,
  FacultyExportQueryInput,
  FacultyExportColumn,
  FacultyExportContext
>({
  manifest: FACULTY_MODULE_MANIFEST,
  normalizeQuery: (query, allowDeleted) => ({
    ...query,
    includeDeleted: normalizeIncludeDeletedFlag(query.includeDeleted, allowDeleted),
  }),
  prepareExport: prepareFacultyExport,
  loadByIds: (ids) => loadFacultyByIds(ids) as Promise<Faculty[]>,
  loadPage: async (query, page, limit, afterId) => {
    const pageResult = await loadFacultyPage({
      ...query,
      page,
      limit,
      afterId: query.sortField ? undefined : afterId,
      skipCount: true,
    } as never);
    const sourceList = (pageResult.faculty ?? []) as Faculty[];
    return {
      rows: sourceList,
      hasMore: pageResult.hasMore,
      nextCursor: (pageResult as { nextCursor?: string }).nextCursor,
    };
  },
  yieldDataChunks: (facultyList, columns, chunkSize, context) => {
    function* gen(): Generator<string, void, undefined> {
      for (let i = 0; i < facultyList.length; i += chunkSize) {
        const chunk = facultyList.slice(i, i + chunkSize);
        const chunkExportRows = buildFacultyExportRows(chunk, columns, context?.settings);
        const dataRows = chunkExportRows.slice(1);
        if (dataRows.length > 0) {
          yield "\n" + buildCsvContent(dataRows);
        }
      }
    }
    return gen();
  },
  extractCell: (faculty, columnId) => createFacultyCellExtractor()(faculty as never, columnId),
});

export const generateFacultyCsvStreamChunks = facultyCsv.generateStreamChunks;
export const buildFacultyCsvExport = facultyCsv.buildExport as (
  query: FacultyExportQueryInput,
  options: FacultyExportOptions,
) => Promise<FacultyExportResult>;
