import { createContext, useContext, type ComponentType } from "react";

export type MessagingHostHook = (...args: any[]) => any;

export interface MessagingHostValue {
  usePermissions: MessagingHostHook;
  useModulePermissions: MessagingHostHook;
  ModuleReports: ComponentType<any>;
  ModuleReportsTier: ComponentType<any>;
  ReportChartCard: ComponentType<any>;
  KPISummary: ComponentType<any>;
  TenantMessageComposer: ComponentType<any>;
}

const MessagingHostContext = createContext<MessagingHostValue | null>(null);

export const MessagingHostProvider = MessagingHostContext.Provider;

/** App-bound messaging host. Module UI never imports `@/…`. */
export function useMessagingHost(): MessagingHostValue {
  const value = useContext(MessagingHostContext);
  if (value) return value;
  if (import.meta.env?.MODE === "test") return TEST_HOST;
  throw new Error("MessagingHostProvider is missing above this component");
}

const T = () => null;
const allow = () => true;
const TEST_HOST: MessagingHostValue = {
  usePermissions: () => ({ can: allow, permissions: [] }),
  useModulePermissions: () => ({ canRead: true, canWrite: true, canManage: true, canDelete: true }),
  ModuleReports: T,
  ModuleReportsTier: T,
  ReportChartCard: T,
  KPISummary: T,
  TenantMessageComposer: T,
};
