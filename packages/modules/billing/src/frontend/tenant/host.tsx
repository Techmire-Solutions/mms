import { createContext, useContext, type ComponentType } from "react";

export type FinanceHostHook = (...args: any[]) => any;

export interface FinanceHostValue {
  usePermissions: FinanceHostHook;
  useModulePermissions: FinanceHostHook;
  useFinanceConfig: FinanceHostHook;
  useBranding: FinanceHostHook;
  useDocumentCurrency: FinanceHostHook;
  useModuleSettingsEditor: FinanceHostHook;
  useCurrency: FinanceHostHook;
  useFinanceCurrency: FinanceHostHook;
  useMessageComposerState: FinanceHostHook;
  useWorkDrillDownListener: FinanceHostHook;
  useGenericModuleExport: FinanceHostHook;
  sessionsCollection: Record<string, FinanceHostHook>;
  accountingCollection: Record<string, FinanceHostHook>;
  studentsCollection: Record<string, FinanceHostHook>;
  UserActorSelect: ComponentType<any>;
  RegistryPersonSelect: ComponentType<any>;
  SessionClassSectionSelect: ComponentType<any>;
  WorkListFiltersScaffold: ComponentType<any>;
  ModuleReportsTier: ComponentType<any>;
  TenantMessageComposer: ComponentType<any>;
}

const FinanceHostContext = createContext<FinanceHostValue | null>(null);
export const FinanceHostProvider = FinanceHostContext.Provider;

/** App-bound finance host. Module UI never imports `@/…`. */
export function useFinanceHostValue(): FinanceHostValue {
  const value = useContext(FinanceHostContext);
  if (value) return value;
  if (import.meta.env?.MODE === "test") return TEST_HOST;
  throw new Error("FinanceHostProvider is missing above this component");
}

const T = () => null;
const allow = () => true;
const TEST_HOST: FinanceHostValue = {
  usePermissions: () => ({ can: allow, permissions: [] }),
  useModulePermissions: () => ({ canRead: true, canWrite: true, canManage: true, canDelete: true }),
  useFinanceConfig: () => ({}),
  useBranding: () => ({}),
  useDocumentCurrency: () => ({ currency: "PKR", format: String }),
  useModuleSettingsEditor: () => ({
    draft: {},
    setDraft: allow,
    save: allow,
    discardDrafts: allow,
  }),
  useCurrency: () => ({ format: (v: unknown) => String(v), currency: "PKR" }),
  useFinanceCurrency: () => ({ format: (v: unknown) => String(v), currency: "PKR" }),
  useMessageComposerState: () => ({ state: {}, setState: allow }),
  useWorkDrillDownListener: () => undefined,
  useGenericModuleExport: () => ({ startExport: allow }),
  sessionsCollection: {},
  accountingCollection: {},
  studentsCollection: {},
  UserActorSelect: T,
  RegistryPersonSelect: T,
  SessionClassSectionSelect: T,
  WorkListFiltersScaffold: T,
  ModuleReportsTier: T,
  TenantMessageComposer: T,
};
