import {
  DEFAULT_FACULTY_EXPORT_COLUMNS,
  facultyColumnLabelKey,
  mergeCustomFacultyExportColumns,
  type AppTranslationKey,
  type FacultyExportColumn,
  type FacultyListQuery,
  type FacultyQuickFilter,
  type FacultySettings,
  type FacultySortField,
} from "@mms/shared";
import { startServerFacultyCsvExport } from "@/lib/backgroundJobs/startServerFacultyCsvExport";
import { useModuleServerCsvExportActions } from "@/lib/backgroundJobs/useModuleServerCsvExportActions";
import { buildFacultyDirectoryQuery } from "@/tenant/features/faculty/hooks/facultyQueryShared";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";

type ExportAuditScope = "all" | "filtered" | "selection";

export interface UseFacultyExportActionsOptions {
  tableColumns: FacultyExportColumn[];
  canExport: boolean;
  search: string;
  filterStatus: string[];
  filterSpecialization: string;
  filterGender: string;
  filterDepartment: string;
  filterDesignation: string;
  filterReportingFacultyId: string;
  quickFilter: FacultyQuickFilter;
  sortField: FacultySortField | null;
  sortDir: "asc" | "desc";
  viewingDeleted: boolean;
  /** Whether any directory filter is applied — selects the audit scope. */
  hasActiveFilters: boolean;
  selectedIds: string[];
  logExportAudit: {
    mutateAsync: (payload: { count: number; scope: ExportAuditScope }) => Promise<unknown>;
  };
}

/** Server CSV export actions for Faculty Work directory. */
export function useFacultyExportActions({
  tableColumns,
  canExport,
  search,
  filterStatus,
  filterSpecialization,
  filterGender,
  filterDepartment,
  filterDesignation,
  filterReportingFacultyId,
  quickFilter,
  sortField,
  sortDir,
  viewingDeleted,
  hasActiveFilters,
  selectedIds,
  logExportAudit,
}: UseFacultyExportActionsOptions) {
  const { t } = useTranslation();

  const buildFilteredQuery = (): FacultyListQuery =>
    buildFacultyDirectoryQuery({
      search,
      filterStatus,
      filterSpecialization,
      filterGender,
      filterDepartment,
      filterDesignation,
      filterReportingFacultyId,
      quickFilter,
      sortField,
      sortDir,
    });

  const onError = (err: unknown, _scope: string) => {
    notify.error(t("faculty.exportFailed"), {
      description: err instanceof Error ? err.message : String(err),
    });
  };

  return useModuleServerCsvExportActions<FacultyExportColumn, FacultyListQuery>({
    canExport,
    trashMode: viewingDeleted,
    selectedIds,
    columns: tableColumns,
    filename: t("faculty.exportFilename"),
    label: t("faculty.jobs.exportLabelServer"),
    successMessage: t("faculty.exportSuccess"),
    auditScope: "faculty.export_audit",
    filteredErrorScope: "faculty.server_export_csv",
    selectionErrorScope: "faculty.server_export_csv_selection",
    hasActiveFilters,
    buildFilteredQuery,
    startExport: startServerFacultyCsvExport,
    logExportAudit,
    onError,
  });
}

/** Default Work export columns when registry is unavailable. */
export function defaultFacultyExportColumns(
  t: (key: AppTranslationKey) => string,
  settings?: FacultySettings | null,
): FacultyExportColumn[] {
  const base = DEFAULT_FACULTY_EXPORT_COLUMNS.map((column) => ({
    id: column.id,
    label: t(facultyColumnLabelKey(column.id)),
  }));
  return mergeCustomFacultyExportColumns(base, settings);
}

/** Resolves active export columns from column registry and visibility state. */
export function resolveFacultyExportColumns(
  columnRegistry: Array<{ key: string; label?: string }>,
  isColumnVisible: (key: string) => boolean,
  t: (key: AppTranslationKey) => string,
  settings?: FacultySettings | null,
): FacultyExportColumn[] {
  const visible = columnRegistry.filter((col) => isColumnVisible(col.key));
  if (visible.length === 0) return defaultFacultyExportColumns(t, settings);
  const columns = visible.map((col) => ({
    id: col.key,
    label: col.label || col.key,
  }));
  if (!columns.some((col) => col.id === "employeeId")) {
    const nameIndex = columns.findIndex((col) => col.id === "name");
    columns.splice(nameIndex >= 0 ? nameIndex + 1 : 0, 0, {
      id: "employeeId",
      label: t(facultyColumnLabelKey("employeeId")),
    });
  }
  return mergeCustomFacultyExportColumns(columns, settings);
}
