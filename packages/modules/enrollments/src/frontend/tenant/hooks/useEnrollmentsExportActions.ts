import {
  mergeCustomEnrollmentExportColumns,
  type AppTranslationKey,
  type EnrollmentExportColumn,
  type EnrollmentsListQuery,
} from "@mms/contracts";
import { startServerEnrollmentsCsvExport } from "../../tenant/lib/startServerEnrollmentsCsvExport.js";
import { useModuleServerCsvExportActions } from "@mms/fe-core/lib/useModuleServerCsvExportActions";
import { useTranslation } from "@mms/fe-core/i18n";
import { notify } from "@mms/fe-core/notify";

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
    onError,
  });
}

/** Default Work export columns when registry is unavailable. */
export function defaultEnrollmentsExportColumns(
  t: (key: AppTranslationKey) => string,
  customColumns?: EnrollmentExportColumn[] | null,
): EnrollmentExportColumn[] {
  const base: EnrollmentExportColumn[] = [
    { id: "studentName", label: t("enrollments.columns.student") },
    { id: "studentId", label: t("enrollments.columns.studentId") },
    { id: "sessionName", label: t("enrollments.columns.session") },
    { id: "sessionId", label: t("enrollments.columns.sessionId") },
    { id: "className", label: t("enrollments.columns.class") },
    { id: "classId", label: t("enrollments.columns.classId") },
    { id: "enrolledDate", label: t("enrollments.columns.enrolledDate") },
    { id: "baseFee", label: t("enrollments.columns.baseFee") },
    { id: "discountType", label: t("enrollments.columns.discountType") },
    { id: "discountPct", label: t("enrollments.columns.discountPct") },
    { id: "discountAmt", label: t("enrollments.columns.discountAmt") },
    { id: "finalFee", label: t("enrollments.columns.finalFee") },
    { id: "status", label: t("enrollments.columns.status") },
    { id: "paymentStatus", label: t("enrollments.columns.payment") },
    { id: "invoiceId", label: t("enrollments.columns.invoiceId") },
    { id: "notes", label: t("enrollments.columns.notes") },
  ];
  return mergeCustomEnrollmentExportColumns(base, customColumns);
}
