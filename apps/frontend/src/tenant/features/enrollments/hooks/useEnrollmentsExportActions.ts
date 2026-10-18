import {
  mergeCustomEnrollmentExportColumns,
  type AppTranslationKey,
  type EnrollmentExportColumn,
  type EnrollmentsListQuery,
} from "@mms/shared";
import { startServerEnrollmentsCsvExport } from "@/lib/backgroundJobs/startServerEnrollmentsCsvExport";
import { useModuleServerCsvExportActions } from "@/lib/backgroundJobs/useModuleServerCsvExportActions";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";

type ExportAuditScope = "all" | "filtered" | "selection";

export interface UseEnrollmentsExportActionsOptions {
  tableColumns: EnrollmentExportColumn[];
  canExport: boolean;
  search: string;
  statusFilter: string;
  sessionFilter: string;
  viewingDeleted: boolean;
  /** Whether any directory filter is applied — selects the audit scope. */
  hasActiveFilters: boolean;
  selectedIds: string[];
  logExportAudit: {
    mutateAsync: (payload: { count: number; scope: ExportAuditScope }) => Promise<unknown>;
  };
}

/** Server CSV export actions for Enrollments Work (Sessions-shaped shared factory). */
export function useEnrollmentsExportActions({
  tableColumns,
  canExport,
  search,
  statusFilter,
  sessionFilter,
  viewingDeleted,
  hasActiveFilters,
  selectedIds,
  logExportAudit,
}: UseEnrollmentsExportActionsOptions) {
  const { t } = useTranslation();

  const buildFilteredQuery = (): EnrollmentsListQuery => ({
    search: search.trim() || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    sessionId: sessionFilter !== "all" ? sessionFilter : undefined,
  });

  const onError = (err: unknown, _scope: string) => {
    notify.error(t("enrollments.exportFailed"), {
      description: err instanceof Error ? err.message : String(err),
    });
  };

  return useModuleServerCsvExportActions<EnrollmentExportColumn, EnrollmentsListQuery>({
    canExport,
    trashMode: viewingDeleted,
    selectedIds,
    columns: tableColumns,
    filename: t("enrollments.exportFilename"),
    label: t("enrollments.jobs.exportLabelServer"),
    successMessage: t("enrollments.exportSuccess"),
    auditScope: "enrollments.export_audit",
    filteredErrorScope: "enrollments.server_export_csv",
    selectionErrorScope: "enrollments.server_export_csv_selection",
    hasActiveFilters,
    buildFilteredQuery,
    startExport: startServerEnrollmentsCsvExport,
    logExportAudit,
    onError,
  });
}

/** Default Work export columns when registry is unavailable. */
export function defaultEnrollmentsExportColumns(
  t: (key: AppTranslationKey) => string,
  customColumns?: EnrollmentExportColumn[] | null,
): EnrollmentExportColumn[] {
  const base: EnrollmentExportColumn[] = [
    { id: "studentName", label: t("enrollments.columns.student" as AppTranslationKey) },
    {
      id: "studentId",
      label: t("enrollments.columns.studentId" as AppTranslationKey) || "Student ID",
    },
    { id: "sessionName", label: t("enrollments.columns.session" as AppTranslationKey) },
    {
      id: "sessionId",
      label: t("enrollments.columns.sessionId" as AppTranslationKey) || "Session ID",
    },
    { id: "className", label: t("enrollments.columns.class" as AppTranslationKey) },
    { id: "classId", label: t("enrollments.columns.classId" as AppTranslationKey) || "Class ID" },
    { id: "enrolledDate", label: t("enrollments.columns.enrolledDate" as AppTranslationKey) },
    { id: "baseFee", label: t("enrollments.columns.baseFee" as AppTranslationKey) || "Base Fee" },
    {
      id: "discountType",
      label: t("enrollments.columns.discountType" as AppTranslationKey) || "Discount Type",
    },
    {
      id: "discountPct",
      label: t("enrollments.columns.discountPct" as AppTranslationKey) || "Discount %",
    },
    {
      id: "discountAmt",
      label: t("enrollments.columns.discountAmt" as AppTranslationKey) || "Discount Amount",
    },
    { id: "finalFee", label: t("enrollments.columns.finalFee" as AppTranslationKey) },
    { id: "status", label: t("enrollments.columns.status" as AppTranslationKey) },
    { id: "paymentStatus", label: t("enrollments.columns.payment" as AppTranslationKey) },
    {
      id: "invoiceId",
      label: t("enrollments.columns.invoiceId" as AppTranslationKey) || "Invoice ID",
    },
    { id: "notes", label: t("enrollments.columns.notes" as AppTranslationKey) || "Notes" },
  ];
  return mergeCustomEnrollmentExportColumns(base, customColumns);
}
