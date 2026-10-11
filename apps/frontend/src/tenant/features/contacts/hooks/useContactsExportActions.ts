import { useMemo } from "react";
import {
  resolveAllContactExportColumns,
  type ContactExportColumn,
  type ContactsListQuery,
  type ContactsQuickFilter,
  type AppTranslationKey,
  type FieldConfig,
} from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { useContactConfig } from "@/lib/contexts/ContactConfigContext";
import { startServerContactsCsvExport } from "@/lib/backgroundJobs/startServerContactsCsvExport";
import { useModuleServerCsvExportActions } from "@/lib/backgroundJobs/useModuleServerCsvExportActions";
import { notify } from "@/lib/notify";
import { reportClientError } from "@/lib/clientErrorReporting";
import { getApiValidationMessage } from "@/lib/apiValidationMessage";

interface UseContactsExportActionsOptions {
  tableColumns: Array<{ id?: string; key?: string; label?: string; labelKey?: AppTranslationKey }>;
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
  logExportAudit: {
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
  tableColumns: _tableColumns,
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
  const effectiveConfig: Partial<FieldConfig> = fieldConfig ?? {
    fields: contactConfig.fields,
    formTabs: contactConfig.formTabs,
  };

  const resolvedColumns = useMemo(
    () => defaultContactsExportColumns(t, effectiveConfig),
    [t, effectiveConfig],
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
  t: (key: AppTranslationKey) => string,
  fieldConfig?: Partial<FieldConfig> | null,
): ContactExportColumn[] {
  const allColumns = resolveAllContactExportColumns(fieldConfig);
  return allColumns.map((column) => {
    const key = `contacts.columns.${column.id}` as AppTranslationKey;
    const translated = t(key);
    return {
      id: column.id,
      label: translated && translated !== key ? translated : column.label,
    };
  });
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
    return defaultContactsExportColumns(t, fieldConfig);
  }
  return mapped.slice(0, 200);
}
