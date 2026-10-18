import {
  mergeCustomSessionExportColumns,
  type AppTranslationKey,
  type SessionExportColumn,
  type SessionsListQuery,
  type SessionsSettings,
} from "@mms/shared";
import { startServerSessionsCsvExport } from "@/lib/backgroundJobs/startServerSessionsCsvExport";
import { useModuleServerCsvExportActions } from "@/lib/backgroundJobs/useModuleServerCsvExportActions";
import type { SessionSortField } from "@/tenant/features/sessions/lib/sessionPageTypes";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";

type ExportAuditScope = "all" | "filtered" | "selection";

export interface UseSessionsExportActionsOptions {
  tableColumns: SessionExportColumn[];
  canExport: boolean;
  search: string;
  filterStatus: string[];
  filterType: string[];
  sortField: SessionSortField;
  sortDir: "asc" | "desc";
  viewingDeleted: boolean;
  selectedIds: string[];
  logExportAudit: {
    mutateAsync: (payload: { count: number; scope: ExportAuditScope }) => Promise<unknown>;
  };
}

/** Server CSV export actions for Sessions Work (Students-shaped shared factory). */
export function useSessionsExportActions({
  tableColumns,
  canExport,
  search,
  filterStatus,
  filterType,
  sortField,
  sortDir,
  viewingDeleted,
  selectedIds,
  logExportAudit,
}: UseSessionsExportActionsOptions) {
  const { t } = useTranslation();

  const buildFilteredQuery = (): SessionsListQuery => ({
    search: search.trim() || undefined,
    status: filterStatus.length > 0 ? filterStatus.join(",") : undefined,
    type: filterType.length > 0 ? filterType.join(",") : undefined,
    sortField,
    sortDir,
  });

  const onError = () => {
    notify.error(t("sessions.exportFailed"));
  };

  return useModuleServerCsvExportActions<SessionExportColumn, SessionsListQuery>({
    canExport,
    trashMode: viewingDeleted,
    selectedIds,
    columns: tableColumns,
    filename: t("sessions.exportFilename"),
    label: t("sessions.jobs.exportLabelServer"),
    successMessage: t("sessions.exportSuccess"),
    auditScope: "sessions.export_audit",
    filteredErrorScope: "sessions.server_export_csv",
    selectionErrorScope: "sessions.server_export_csv_selection",
    buildFilteredQuery,
    startExport: startServerSessionsCsvExport,
    logExportAudit,
    onError,
  });
}

/** Default Work export columns when registry is unavailable. */
export function defaultSessionsExportColumns(
  t: (key: AppTranslationKey) => string,
  settings?: SessionsSettings | null,
): SessionExportColumn[] {
  const base: SessionExportColumn[] = [
    { id: "name", label: t("sessions.columns.name" as AppTranslationKey) },
    { id: "type", label: t("sessions.columns.type" as AppTranslationKey) },
    { id: "status", label: t("sessions.columns.status" as AppTranslationKey) },
    {
      id: "startDate",
      label: t("sessions.columns.startDate" as AppTranslationKey) || "Start Date",
    },
    { id: "endDate", label: t("sessions.columns.endDate" as AppTranslationKey) || "End Date" },
    { id: "duration", label: t("sessions.columns.duration" as AppTranslationKey) },
    { id: "baseFee", label: t("sessions.columns.fee" as AppTranslationKey) },
    { id: "currency", label: t("sessions.columns.currency" as AppTranslationKey) || "Currency" },
    {
      id: "description",
      label: t("sessions.columns.description" as AppTranslationKey) || "Description",
    },
    {
      id: "enrolled",
      label: t("sessions.columns.enrolled" as AppTranslationKey) || "Enrolled Students",
    },
    { id: "capacity", label: t("sessions.columns.capacity" as AppTranslationKey) || "Capacity" },
    {
      id: "classesCount",
      label: t("sessions.columns.classesCount" as AppTranslationKey) || "Classes Count",
    },
    { id: "classNames", label: t("sessions.columns.classes" as AppTranslationKey) || "Classes" },
    {
      id: "facultyCount",
      label: t("sessions.columns.facultyCount" as AppTranslationKey) || "Faculty Count",
    },
    {
      id: "facultyNames",
      label: t("sessions.columns.faculty" as AppTranslationKey) || "Assigned Faculty",
    },
  ];
  return mergeCustomSessionExportColumns(base, settings);
}
