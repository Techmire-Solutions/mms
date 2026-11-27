import type { ComponentType } from "react";
import type { AccountingSettings, BrandingChartPaletteHex, BrandingSettings } from "@mms/contracts";
import { DEFAULT_BRANDING_SETTINGS } from "@mms/contracts";

/** A configurable account field rendered by the accounting forms. */
export interface AccountingFieldMeta {
  id: string;
  required?: boolean;
  label?: string;
  [key: string]: unknown;
}

/** Standard-module config for accounting (fields, ordering, enable flags). */
export interface AccountingConfig {
  settings: AccountingSettings;
  fields: Record<string, AccountingFieldMeta & { required?: boolean }>;
  orderedFields: AccountingFieldMeta[];
  isFieldEnabled: (id: string) => boolean;
  [key: string]: unknown;
}

/** Session currency metadata and formatter. */
export interface AccountingCurrencyFormat {
  format: (value: number) => string;
  currency: string;
}

/** The draft/save contract exposed by the module settings editor. */
export interface ModuleSettingsEditorState<T> {
  settings: T;
  settingsDraft: T;
  saved: boolean;
  setSaved: (value: boolean | ((current: boolean) => boolean)) => void;
  upd: <K extends keyof T>(key: K, value: T[K]) => void;
  saveSettingsAsync: () => Promise<void>;
  isPrefsDirty: boolean;
  isPrefsReady: boolean;
  saving: boolean;
}

/** Document-level multi-currency state (IAS 21 transaction currency). */
export interface DocumentCurrencyState {
  functionalCurrency: string;
  currency: string;
  setCurrency: (next: string) => void;
  isForeign: boolean;
  rateCurrency: string | null;
  needsRate: boolean;
  rate: string;
  rateOverride: string;
  setRateOverride: (value: string) => void;
  lookedUpRate: { rate: string } | null;
  rateMissing: boolean;
  currencyOptions: Array<{ code: string; name: string; symbol: string }>;
  showCurrencyPicker: boolean;
}

export interface FacultyLookupMember {
  id: string;
  name?: string;
  employeeId?: string;
  designation?: string;
}

export interface AccountingHostValue {
  useAccountingCurrency: () => AccountingCurrencyFormat;
  useAccountingConfig: () => AccountingConfig;
  useGenericModuleExport: (options: unknown) => {
    handleExport: () => void;
    isExporting: boolean;
  };
  useBrandPalette: () => BrandingChartPaletteHex;
  useBranding: () => BrandingSettings;
  useDocumentCurrency: (options?: unknown) => DocumentCurrencyState;
  useModuleSettingsEditor: <T = AccountingSettings>(
    options: unknown,
  ) => ModuleSettingsEditorState<T>;
  useModulePermissions: (config?: unknown) => {
    canRead: boolean;
    canWrite: boolean;
    canManage: boolean;
    canDelete: boolean;
    canEditSetup: boolean;
    canReports: boolean;
    canViewSetup: boolean;
  };
  usePermissions: () => { can: (permission: string) => boolean; permissions: string[] };
  facultyResolveQueryOptions: (ids: string[]) => {
    queryKey: readonly unknown[];
    queryFn: () => Promise<FacultyLookupMember[]>;
  };
  RegistryPersonSelect: ComponentType<Record<string, unknown>>;
  ReportDataGridContainer: ComponentType<{ children?: React.ReactNode }>;
  ModuleReportsTier: ComponentType<Record<string, unknown>>;
  PinnedWidgets: ComponentType<Record<string, unknown>>;
  MutedTableHeaderRow: ComponentType<Record<string, unknown>>;
  FinancialDebitCreditTableChrome: ComponentType<Record<string, unknown>>;
}

let configured: AccountingHostValue | null = null;

export function configureAccountingHost(next: AccountingHostValue): void {
  configured = next;
}

export function getAccountingHost(): AccountingHostValue {
  if (configured) return configured;
  if (import.meta.env?.MODE === "test") return TEST_HOST;
  throw new Error("Accounting host is not configured (call configureAccountingHost)");
}

const Placeholder = () => null;
const PassThrough = ({ children }: { children?: React.ReactNode }) => children as React.ReactNode;

const TEST_HOST: AccountingHostValue = {
  useAccountingCurrency: () => ({ format: (value: number) => String(value), currency: "PKR" }),
  useAccountingConfig: () => ({
    settings: {} as AccountingSettings,
    fields: {},
    orderedFields: [],
    isFieldEnabled: () => true,
  }),
  useGenericModuleExport: () => ({ handleExport: () => undefined, isExporting: false }),
  useBrandPalette: () => ({}) as BrandingChartPaletteHex,
  useBranding: () => DEFAULT_BRANDING_SETTINGS as BrandingSettings,
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
  useModuleSettingsEditor: <T = AccountingSettings>() =>
    ({
      settings: {} as T,
      settingsDraft: {} as T,
      saved: false,
      setSaved: () => undefined,
      upd: () => undefined,
      saveSettingsAsync: async () => undefined,
      isPrefsDirty: false,
      isPrefsReady: true,
      saving: false,
    }) as ModuleSettingsEditorState<T>,
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
    queryFn: async () => [] as FacultyLookupMember[],
  }),
  RegistryPersonSelect: Placeholder,
  ReportDataGridContainer: PassThrough,
  ModuleReportsTier: Placeholder,
  PinnedWidgets: PassThrough,
  MutedTableHeaderRow: Placeholder,
  FinancialDebitCreditTableChrome: Placeholder,
};
