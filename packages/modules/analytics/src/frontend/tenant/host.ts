import type { ComponentType } from "react";

export type AnalyticsHostHook = (...args: any[]) => any;

export interface AnalyticsHostValue {
  useCurrency: AnalyticsHostHook;
  useFinanceCurrency: AnalyticsHostHook;
  useDashboardConfig: AnalyticsHostHook;
  useSavedReportsSource: AnalyticsHostHook;
  useBrandPalette: AnalyticsHostHook;
  usePermissions: AnalyticsHostHook;
  useModulePermissions: AnalyticsHostHook;
  useIsAdminViewer: AnalyticsHostHook;
  collections: Record<string, Record<string, AnalyticsHostHook> & Record<string, unknown>>;
  ChartTooltip: ComponentType<any>;
  ChartTooltipRow: ComponentType<any>;
  SessionsTable: ComponentType<any>;
  MessagingReportsVolumeChart: ComponentType<any>;
  dashboardWidgetRegistry: Record<string, unknown>;
  reportModuleAdapters: Record<string, ComponentType<any>>;
  reportLibs: Record<string, unknown>;
}

let configured: AnalyticsHostValue | null = null;

/** Composition-root binding; called by the app provider bridge. */
export function configureAnalyticsHost(next: AnalyticsHostValue): void {
  configured = next;
}

/** App-bound analytics host. Module UI never imports `@/…`. */
export function getAnalyticsHost(): AnalyticsHostValue {
  if (configured) return configured;
  if (import.meta.env?.MODE === "test") return TEST_HOST;
  throw new Error("Analytics host is not configured (call configureAnalyticsHost)");
}

const T = () => null;
const allow = () => true;
const TEST_HOST: AnalyticsHostValue = {
  useCurrency: () => ({ format: (v: unknown) => String(v), currency: "PKR" }),
  useFinanceCurrency: () => ({ format: (v: unknown) => String(v), currency: "PKR" }),
  useDashboardConfig: () => ({ config: {} }),
  useSavedReportsSource: () => ({ savedReports: [] }),
  useBrandPalette: () => ({ palette: {} }),
  usePermissions: () => ({ can: allow, permissions: [] }),
  useModulePermissions: () => ({ canRead: true, canWrite: true, canManage: true, canDelete: true }),
  useIsAdminViewer: () => true,
  collections: {},
  ChartTooltip: T,
  ChartTooltipRow: T,
  SessionsTable: T,
  MessagingReportsVolumeChart: T,
  dashboardWidgetRegistry: {},
  reportModuleAdapters: {},
  reportLibs: {},
};
