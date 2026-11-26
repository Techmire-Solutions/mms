import React from "react";
import { getAttendanceHost } from "../host.js";

export function ModuleReportsTier(props: Record<string, unknown>): React.JSX.Element {
  const C = (getAttendanceHost() as any).ModuleReportsTier as React.ComponentType<any>;
  return <C {...props} />;
}

export function ReportChartCard(props: Record<string, unknown>): React.JSX.Element {
  return <section {...(props as any)} />;
}

export default ModuleReportsTier;

export function KPISummary(props: Record<string, unknown>): React.JSX.Element {
  return <section {...(props as any)} />;
}

export function ModuleReports(props: Record<string, unknown>): React.JSX.Element {
  return <section {...(props as any)} />;
}
