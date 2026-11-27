import React from "react";
import { getAnalyticsHost } from "../host.js";

export function adapter(name: string, props: any): React.JSX.Element {
  const C = (getAnalyticsHost() as any).reportModuleAdapters?.[name] as React.ComponentType<any>;
  if (!C) return <pre data-testid="adapter-fallback">{JSON.stringify(props)}</pre>;
  return <C {...props} />;
}

export const ActivityLogs = (props: any) => adapter("ActivityLogs", props);
export const AutoGrading = (props: any) => adapter("AutoGrading", props);
export const EnrollmentReports = (props: any) => adapter("EnrollmentReports", props);
export const FinancialReports = (props: any) => adapter("FinancialReports", props);
export const ObligationsSummary = (props: any) => adapter("ObligationsSummary", props);
export const PerformanceAnalytics = (props: any) => adapter("PerformanceAnalytics", props);
export const UsersCommandMetrics = (props: any) => adapter("UsersCommandMetrics", props);
