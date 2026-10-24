import {
  mergeCustomUserExportColumns,
  type AppTranslationKey,
  type UserExportColumn,
  type UsersListQuery,
} from "@mms/shared";
import { startServerUsersCsvExport } from "@/lib/backgroundJobs/startServerUsersCsvExport";
import { useModuleServerCsvExportActions } from "@/lib/backgroundJobs/useModuleServerCsvExportActions";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";

type ExportAuditScope = "all" | "filtered" | "selection";

export interface UseUsersExportActionsOptions {
  tableColumns: UserExportColumn[];
  canExport: boolean;
  search: string;
  roleFilter: string;
  statusFilter: string;
  viewingDeleted: boolean;
  selectedIds: string[];
  logExportAudit: {
    mutateAsync: (payload: { count: number; scope: ExportAuditScope }) => Promise<unknown>;
  };
}

/** Server CSV export actions for Users Work. */
export function useUsersExportActions({
  tableColumns,
  canExport,
  search,
  roleFilter,
  statusFilter,
  viewingDeleted,
  selectedIds,
  logExportAudit,
}: UseUsersExportActionsOptions) {
  const { t } = useTranslation();

  const buildFilteredQuery = (): UsersListQuery => ({
    search: search.trim() || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    role: roleFilter !== "all" ? roleFilter : undefined,
  });

  const onError = (err: unknown) => {
    notify.error(t("users.exportFailed"), {
      description: err instanceof Error ? err.message : String(err),
    });
  };

  return useModuleServerCsvExportActions<UserExportColumn, UsersListQuery>({
    canExport,
    trashMode: viewingDeleted,
    selectedIds,
    columns: tableColumns,
    filename: t("users.exportFilename"),
    label: t("users.jobs.exportLabelServer"),
    successMessage: t("users.exportSuccess"),
    auditScope: "users.export_audit",
    filteredErrorScope: "users.server_export_csv",
    selectionErrorScope: "users.server_export_csv_selection",
    buildFilteredQuery,
    startExport: startServerUsersCsvExport,
    logExportAudit,
    onError,
  });
}

/** Default Work export columns. */
export function defaultUsersExportColumns(
  t: (key: AppTranslationKey) => string,
  customColumns?: UserExportColumn[] | null,
): UserExportColumn[] {
  const base: UserExportColumn[] = [
    { id: "name", label: t("users.colUser" as AppTranslationKey) },
    { id: "email", label: t("users.fieldContactEmail" as AppTranslationKey) },
    { id: "loginEmail", label: t("users.fieldLoginEmail" as AppTranslationKey) || "Login Email" },
    { id: "role", label: t("users.colRole" as AppTranslationKey) },
    { id: "roleSource", label: t("users.colRoleSource" as AppTranslationKey) || "Role Source" },
    { id: "status", label: t("users.colStatus" as AppTranslationKey) },
    { id: "phone", label: t("users.fieldPhone" as AppTranslationKey) },
    { id: "twoFactorEnabled", label: t("users.col2fa" as AppTranslationKey) },
    {
      id: "mustChangePassword",
      label: t("users.colPasswordReset" as AppTranslationKey) || "Password Reset",
    },
    { id: "lastLogin", label: t("users.colLastLogin" as AppTranslationKey) },
    { id: "createdDate", label: t("users.colCreated" as AppTranslationKey) },
    {
      id: "failedLoginAttempts",
      label: t("users.colFailedLogins" as AppTranslationKey) || "Failed Logins",
    },
    {
      id: "activeSessions",
      label: t("users.colActiveSessions" as AppTranslationKey) || "Active Sessions",
    },
  ];
  return mergeCustomUserExportColumns(base, customColumns);
}
