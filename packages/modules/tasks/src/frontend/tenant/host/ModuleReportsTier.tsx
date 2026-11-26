import React from "react";
import { getTasksHost } from "../host.js";

export function ModuleReportsTier(props: Record<string, unknown>): React.JSX.Element {
  const C = (getTasksHost() as any).ModuleReportsTier as React.ComponentType<any>;
  return <C {...props} />;
}

export function ReportChartCard(props: Record<string, unknown>): React.JSX.Element {
  return <section {...(props as any)} />;
}

export default ModuleReportsTier;
