import type { ComponentType } from "react";

export type ObligationsHostHook = (...args: any[]) => any;

export interface ObligationsHostValue {
  usePermissions: ObligationsHostHook;
  useModulePermissions: ObligationsHostHook;
  useFinanceCurrency: ObligationsHostHook;
  useMessageComposerState: ObligationsHostHook;
  useGenericModuleExport: ObligationsHostHook;
  useBrandPalette: ObligationsHostHook;
  useBranding: ObligationsHostHook;
  useContactsByIds: ObligationsHostHook;
  useUsersByIds: ObligationsHostHook;
  accountingCollection: Record<string, unknown>;
  ReportChartCard: ComponentType<any>;
  ReportDataGridContainer: ComponentType<any>;
  PinnedWidgets: ComponentType<any>;
  UserActorSelect: ComponentType<any>;
  MessageComposer: ComponentType<any>;
  ContactPicker: ComponentType<any>;
}

let configured: ObligationsHostValue | null = null;

/** Composition-root binding; called by the app provider bridge. */
export function configureObligationsHost(next: ObligationsHostValue): void {
  configured = next;
}

/** App-bound obligations host. Module UI never imports `@/…`. */
export function getObligationsHost(): ObligationsHostValue {
  if (configured) return configured;
  if (import.meta.env?.MODE === "test") return TEST_HOST;
  throw new Error("Obligations host is not configured (call configureObligationsHost)");
}

const T = () => null;
const allow = () => true;
const ChildrenStub = ({ children }: { children?: unknown }) => children as never;
const TEST_HOST: ObligationsHostValue = {
  usePermissions: () => ({ can: allow, permissions: [] }),
  useModulePermissions: () => ({ canRead: true, canWrite: true, canManage: true, canDelete: true }),
  useFinanceCurrency: () => ({ format: (v: unknown) => String(v), currency: "PKR" }),
  useMessageComposerState: () => ({}),
  useGenericModuleExport: () => ({ startExport: allow }),
  useBrandPalette: () => ({ palette: {} }),
  useBranding: () => ({}),
  useContactsByIds: () => ({ byId: new Map(), isLoading: false }),
  useUsersByIds: () => ({ byId: new Map(), isLoading: false }),
  accountingCollection: {
    ACCOUNTING_ENTRIES_QUERY_KEY: ["accounting", "entries"],
    ACCOUNTING_REPORT_AGGREGATES_QUERY_KEY: ["accounting", "report-aggregates"],
    useAccountingContractAccounts: () => ({ data: [], isLoading: false }),
  },
  ReportChartCard: T,
  ReportDataGridContainer: ChildrenStub as ComponentType<any>,
  PinnedWidgets: ChildrenStub as ComponentType<any>,
  UserActorSelect: T,
  MessageComposer: T,
  ContactPicker: T,
};
