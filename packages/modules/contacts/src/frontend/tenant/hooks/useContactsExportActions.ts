import { useMemo } from "react";
import {
  resolveAllContactExportColumns,
  type ContactExportColumn,
  type ContactsListQuery,
  type ContactsQuickFilter,
  type AppTranslationKey,
  type FieldConfig,
} from "@mms/contracts";
import type { TranslationFunction } from "@mms/fe-core/i18n";
import { useContactConfig } from "@mms/mod-contacts/frontend/tenant/components/ContactConfigContext";
import { startServerContactsCsvExport } from "@mms/mod-contacts/frontend/tenant/lib/startServerContactsCsvExport";
import { useModuleServerCsvExportActions } from "@mms/fe-core/lib/useModuleServerCsvExportActions";
import { notify } from "@mms/fe-core/notify";
import { reportClientError } from "@mms/fe-core/reporting/clientErrorReporting";
import { getApiValidationMessage } from "@mms/fe-core/api/validationMessage";

interface UseContactsExportActionsOptions {
  fieldConfig?: Partial<FieldConfig> | null;
  canExport: boolean;
  /** Debounced directory search — the same value the visible list was filtered by. */
  search: string;
  filterGender: string;
  sortField: string;
  sortDir: "asc" | "desc";
  quickFilter: ContactsQuickFilter;
  viewingDeleted: boolean;
  /** Whether any directory filter is applied — selects the audit scope. */
  hasActiveFilters: boolean;
  selected: (string | number)[];
  /**
   * Legacy client-reported audit; omitted for contacts because the queued export
   * already writes the authoritative server-side audit row (C-09).
   */
  logExportAudit?: {
    mutateAsync: (payload: {
      count: number;
      scope: "all" | "filtered" | "selection";
    }) => Promise<unknown>;
  };
  handleError?: (err: unknown, scope: string, messageKey?: AppTranslationKey) => void;
  t: TranslationFunction;
  tenantName?: string;
}

export function useContactsExportActions({
  fieldConfig,
  canExport,
  search,
  filterGender,
  sortField,
  sortDir,
  quickFilter,
  viewingDeleted,
  hasActiveFilters,
  selected,
  logExportAudit,
  t,
  tenantName,
}: UseContactsExportActionsOptions) {
  const contactConfig = useContactConfig();
  const effectiveConfig: Partial<FieldConfig> = useMemo(
    () =>
      fieldConfig ?? {
        fields: contactConfig.fields,
        formTabs: contactConfig.formTabs,
      },
    [fieldConfig, contactConfig.fields, contactConfig.formTabs],
  );

  const resolvedColumns = useMemo(
    () => defaultContactsExportColumns(effectiveConfig),
    [effectiveConfig],
  );

  /** Mirrors `buildContactsPageUrl` so the export scope matches the visible list. */
  const buildFilteredQuery = (): ContactsListQuery => ({
    search: search.trim() || undefined,
    gender: filterGender || undefined,
    sortField,
    sortDir,
    quickFilter: quickFilter === "all" ? undefined : quickFilter,
  });

  const onError = (err: unknown, scope: string) => {
    const validationMessage = getApiValidationMessage(err);
    const description = validationMessage || (err instanceof Error ? err.message : String(err));
    notify.error(t("contacts.exportFailed"), description ? { description } : undefined);
    reportClientError(err, { scope });
  };

  return useModuleServerCsvExportActions<ContactExportColumn, ContactsListQuery>({
    canExport,
    trashMode: viewingDeleted,
    selectedIds: selected,
    columns: resolvedColumns,
    filename: t("contacts.exportFilename"),
    label: t("contacts.jobs.exportLabelServer"),
    successMessage: t("contacts.exportSuccess"),
    auditScope: "contacts.export_audit",
    filteredErrorScope: "contacts.server_export_csv",
    selectionErrorScope: "contacts.server_export_csv_selection",
    hasActiveFilters,
    buildFilteredQuery,
    startExport: startServerContactsCsvExport,
    logExportAudit,
    onError,
    tenantName,
  });
}

/** Default Work export columns including custom fields when fieldConfig is present. */
export function defaultContactsExportColumns(
  fieldConfig?: Partial<FieldConfig> | null,
): ContactExportColumn[] {
  const allColumns = resolveAllContactExportColumns(fieldConfig);
  // Export column labels come from the shared English registry; there is no
  // `contacts.columns.*` key per export id, so skip the (always-missing) lookup.
  return allColumns.map((column) => ({ id: column.id, label: column.label }));
}

/** Resolves and sanitizes active export columns for backend CSV job. */
export function resolveContactsExportColumns(
  columns: Array<{ id?: string; key?: string; label?: string; labelKey?: AppTranslationKey }>,
  t: (key: AppTranslationKey) => string,
  fieldConfig?: Partial<FieldConfig> | null,
): ContactExportColumn[] {
  const mapped = columns
    .map((col) => {
      const id = (col.id || col.key || "").trim();
      const label = (col.labelKey ? t(col.labelKey) : col.label || id).trim();
      return { id, label: label || id };
    })
    .filter((col) => col.id.length > 0 && col.id.length <= 64 && col.label.length > 0);

  if (mapped.length === 0) {
    return defaultContactsExportColumns(fieldConfig);
  }
  return mapped.slice(0, 200);
}
