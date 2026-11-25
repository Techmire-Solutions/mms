import type { RelationalCollectionMapping } from "./relationalReplaceMappingTypes.js";

/** Finance, accounting, messaging, dashboard, and audit collections. */
export const RELATIONAL_REPLACE_MAPPING_FINANCE_MESSAGING: Record<
  string,
  RelationalCollectionMapping
> = {
  finance_invoices: {
    importPath: "@mms/mod-billing/backend/repository",
    fnName: "replaceInvoicesForWorkspace",
    snapshotFnName: "listInvoicesByWorkspace",
  },
  finance_payments: {
    importPath: "@mms/mod-billing/backend/repository",
    fnName: "replacePaymentsForWorkspace",
    snapshotFnName: "listPaymentsByWorkspace",
  },
  finance_field_configs: {
    priority: 36,
    importPath: "@mms/mod-billing/backend/repository",
    fnName: "replaceFinanceFieldConfigsForWorkspace",
    snapshotFnName: "listAllFinanceFieldConfigsByWorkspace",
  },
  finance_module_preferences: {
    priority: 37,
    importPath: "@mms/mod-billing/backend/repository",
    fnName: "replaceFinanceModulePreferencesForWorkspace",
    snapshotFnName: "listAllFinanceModulePreferencesByWorkspace",
  },
  accounting_field_configs: {
    priority: 43,
    importPath: "@mms/mod-accounting/backend/repository",
    fnName: "replaceAccountingFieldConfigsForWorkspace",
    snapshotFnName: "listAllAccountingFieldConfigsByWorkspace",
  },
  accounting_module_preferences: {
    priority: 44,
    importPath: "@mms/mod-accounting/backend/repository",
    fnName: "replaceAccountingModulePreferencesForWorkspace",
    snapshotFnName: "listAllAccountingModulePreferencesByWorkspace",
  },
  accounting_accounts: {
    importPath: "@mms/mod-accounting/backend/repository",
    fnName: "replaceAccountsForWorkspace",
    snapshotFnName: "listAccountsByWorkspace",
  },
  accounting_entries: {
    importPath: "@mms/mod-accounting/backend/repository",
    fnName: "replaceEntriesForWorkspace",
    snapshotFnName: "listEntriesByWorkspace",
  },
  accounting_fiscal_years: {
    importPath: "@mms/mod-accounting/backend/repository",
    fnName: "replaceFiscalYearsForWorkspace",
    snapshotFnName: "listFiscalYearsByWorkspace",
  },
  user_activity_logs: {
    importPath: "./repositories/logsRepository.js",
    fnName: "replaceActivityLogsForWorkspace",
    snapshotFnName: "listActivityLogsByWorkspace",
  },
  message_templates: {
    importPath: "@mms/mod-messaging/backend/repository",
    fnName: "replaceMessageTemplatesForWorkspace",
    snapshotFnName: "listMessageTemplatesByWorkspace",
  },
  message_logs: {
    importPath: "@mms/mod-messaging/backend/repository",
    fnName: "replaceMessageLogsForWorkspace",
    // Archived rows are part of the workspace state: the restore hard-replaces
    // the table, so an active-only snapshot would silently drop the archived
    // window (`mms-soft-delete`).
    snapshotFnName: "listAllMessageLogsByWorkspace",
  },
  saved_reports: {
    importPath: "./repositories/savedReportsRepository.js",
    fnName: "replaceSavedReportsForWorkspace",
    snapshotFnName: "listAllSavedReportsByWorkspace",
  },
  dashboard_preferences: {
    priority: 41,
    importPath: "./repositories/dashboardPreferencesRepository.js",
    fnName: "replaceDashboardPreferencesForWorkspace",
    snapshotFnName: "listAllDashboardPreferencesByWorkspace",
  },
  dashboard_widgets: {
    priority: 42,
    importPath: "./repositories/dashboardWidgetsRepository.js",
    fnName: "replaceDashboardWidgetsForWorkspace",
    snapshotFnName: "listAllDashboardWidgetsByWorkspace",
  },
};
