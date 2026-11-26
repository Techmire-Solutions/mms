import React from "react";
import {
  MessagingHostProvider,
  type MessagingHostValue,
} from "@mms/mod-messaging/frontend/tenant/host";
import { usePermissions, useModulePermissions } from "@/tenant/hooks/usePermissions";
import {
  KPISummary,
  ModuleReports,
  ModuleReportsTier,
  ReportChartCard,
} from "@/tenant/components/moduleReports";
import TenantMessageComposer from "@/tenant/components/messaging/TenantMessageComposer";

/** Binds the app's RBAC, report containers, and composer into the messaging module host. */
export function MessagingHostBridge({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <MessagingHostProvider
      value={{
        usePermissions,
        useModulePermissions,
        ModuleReports: ModuleReports as unknown as MessagingHostValue["ModuleReports"],
        ModuleReportsTier: ModuleReportsTier as unknown as MessagingHostValue["ModuleReportsTier"],
        ReportChartCard: ReportChartCard as unknown as MessagingHostValue["ReportChartCard"],
        KPISummary: KPISummary as unknown as MessagingHostValue["KPISummary"],
        TenantMessageComposer:
          TenantMessageComposer as unknown as MessagingHostValue["TenantMessageComposer"],
      }}
    >
      {children}
    </MessagingHostProvider>
  );
}
