import React from "react";
import { configureTasksHost } from "@mms/mod-tasks/frontend/tenant/host";
import { usePermissions, useModulePermissions } from "@/tenant/hooks/usePermissions";
import { useGenericModuleExport } from "@/lib/backgroundJobs/useGenericModuleExport";
import * as BrandingPaletteContext from "@/lib/contexts/BrandingPaletteContext";
import { ModuleReportsTier, ReportChartCard } from "@/tenant/components/moduleReports";

/** Binds the app's RBAC, branding, export and reports surfaces into the tasks module host. */
export function TasksHostBridge({ children }: { children: React.ReactNode }): React.JSX.Element {
  configureTasksHost({
    usePermissions,
    useModulePermissions,
    useGenericModuleExport,
    BrandingPaletteContext: BrandingPaletteContext as unknown as Record<string, unknown>,
    ModuleReportsTier: ModuleReportsTier as unknown as React.ComponentType<Record<string, never>>,
    ReportChartCard: ReportChartCard as unknown as React.ComponentType<Record<string, never>>,
  });
  return <>{children}</>;
}
