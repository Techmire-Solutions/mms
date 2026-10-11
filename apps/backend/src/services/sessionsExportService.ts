import {
  SESSIONS_MODULE_MANIFEST,
  buildCsvContent,
  buildSessionsExportRows,
  extractSessionCell,
  filterSessionExportColumnsForViewer,
  resolveAllSessionExportColumns,
  mergeCustomSessionExportColumns,
  type Session,
  type SessionExportColumn,
  type SessionsListQuery,
  type SessionsSettings,
} from "@mms/shared";
import {
  createModuleExportService,
  type ModuleExportQueryInput,
  type ModuleExportOptions,
  type ModuleExportResult,
} from "../lib/createModuleExportService.js";
import { normalizeIncludeDeletedFlag } from "../lib/csvExportStreamFactory.js";
import { loadSessionsSettingsCombined } from "./sessionConfigService.js";
import { loadSessionsByIds, loadSessionsPage } from "./sessionService.js";

export type SessionsExportQueryInput = ModuleExportQueryInput<SessionsListQuery>;
export type SessionsExportOptions = ModuleExportOptions<SessionExportColumn>;
export type SessionsExportResult = ModuleExportResult;
export type SessionsCsvExportOptions = SessionsExportOptions;
export type SessionsCsvExportResult = SessionsExportResult;

async function loadSessionsFieldSettings(): Promise<SessionsSettings | null> {
  try {
    return await loadSessionsSettingsCombined();
  } catch {
    return null;
  }
}

async function prepareSessionsExport(
  options: SessionsExportOptions,
): Promise<{ columns: SessionExportColumn[]; context: undefined }> {
  const settings = await loadSessionsFieldSettings();
  const requestedColumns =
    options.columns && options.columns.length > 0
      ? mergeCustomSessionExportColumns(options.columns, settings)
      : resolveAllSessionExportColumns(settings);
  const columns = filterSessionExportColumnsForViewer(requestedColumns, settings);
  return { columns, context: undefined };
}

const sessionsCsv = createModuleExportService<
  Session,
  SessionsExportQueryInput,
  SessionExportColumn
>({
  manifest: SESSIONS_MODULE_MANIFEST,
  normalizeQuery: (query, allowDeleted) => ({
    ...query,
    includeDeleted: normalizeIncludeDeletedFlag(query.includeDeleted, allowDeleted),
  }),
  prepareExport: prepareSessionsExport,
  loadByIds: loadSessionsByIds,
  loadPage: async (query, page, limit, afterId) => {
    const pageResult = await loadSessionsPage({
      ...query,
      page,
      limit,
      afterId,
      skipCount: true,
    } as never);
    return {
      rows: pageResult.sessions as Session[],
      hasMore: pageResult.hasMore,
      nextCursor: (pageResult as { nextCursor?: string }).nextCursor,
    };
  },
  yieldDataChunks: (sessionRows, columns, chunkSize) => {
    function* gen(): Generator<string, void, undefined> {
      for (let i = 0; i < sessionRows.length; i += chunkSize) {
        const chunk = sessionRows.slice(i, i + chunkSize);
        const chunkExportRows = buildSessionsExportRows(chunk, columns);
        const dataRows = chunkExportRows.slice(1);
        if (dataRows.length > 0) {
          yield "\n" + buildCsvContent(dataRows);
        }
      }
    }
    return gen();
  },
  extractCell: extractSessionCell,
});

export const generateSessionsCsvStreamChunks = sessionsCsv.generateStreamChunks;
export const streamSessionsCsvExport = sessionsCsv.streamExport;
export const buildSessionsCsvExport = sessionsCsv.buildExport as (
  query: SessionsExportQueryInput,
  options: SessionsExportOptions,
) => Promise<SessionsExportResult>;
