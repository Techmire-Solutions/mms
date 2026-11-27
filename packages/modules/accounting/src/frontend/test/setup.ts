import { configureAccountingHost } from "../tenant/host.js";
import type { AccountingHostValue } from "../tenant/host.js";

/** Rich typed defaults so unit tests don't need the app's provider tree. */
const TEST_ACCOUNTING_HOST: AccountingHostValue = {
  useAccountingCurrency: () => ({ format: (value) => `Rs ${value}`, currency: "PKR" }),
  useAccountingConfig: () => ({
    settings: { decimalSeparator: "period" } as never,
    fields: {},
    orderedFields: [],
    isFieldEnabled: () => true,
  }),
  useGenericModuleExport: () => ({ handleExport: () => undefined, isExporting: false }),
  useBrandPalette: () => ({}) as never,
  useBranding: () => ({}) as never,
  useDocumentCurrency: () => ({
    functionalCurrency: "PKR",
    currency: "PKR",
    setCurrency: () => undefined,
    isForeign: false,
    rateCurrency: null,
    needsRate: false,
    rate: "",
    rateOverride: "",
    setRateOverride: () => undefined,
    lookedUpRate: null,
    rateMissing: false,
    currencyOptions: [],
    showCurrencyPicker: false,
  }),
  useModuleSettingsEditor: () =>
    ({
      settings: {} as never,
      settingsDraft: {} as never,
      saved: false,
      setSaved: () => undefined,
      upd: () => undefined,
      saveSettingsAsync: async () => undefined,
      isPrefsDirty: false,
      isPrefsReady: true,
      saving: false,
    }) as never,
  useModulePermissions: () => ({
    canRead: true,
    canWrite: true,
    canManage: true,
    canDelete: true,
    canEditSetup: true,
    canReports: true,
    canViewSetup: true,
  }),
  usePermissions: () => ({ can: () => true, permissions: [] }),
  facultyResolveQueryOptions: () => ({
    queryKey: ["faculty"] as const,
    queryFn: async () => [],
  }),
  RegistryPersonSelect: () => null,
  ReportDataGridContainer: ({ children }) => children as never,
  ModuleReportsTier: () => null,
  PinnedWidgets: ({ children }) => children as never,
  MutedTableHeaderRow: () => null,
  FinancialDebitCreditTableChrome: () => null,
};

configureAccountingHost(TEST_ACCOUNTING_HOST);
