import React from "react";
import { getEnrollmentsHost } from "../host.js";

export function ModuleReportsTier(props: Record<string, unknown>): React.JSX.Element {
  const C = (getEnrollmentsHost() as any).ModuleReportsTier as React.ComponentType<any>;
  return <C {...props} />;
}

export default ModuleReportsTier;

export function ReportDataGridContainer(props: Record<string, unknown>): React.JSX.Element {
  const C = (getEnrollmentsHost() as any).ReportDataGridContainer as React.ComponentType<any>;
  return C ? <C {...props} /> : <>{props.children as React.ReactNode}</>;
}

export function PinnedWidgets(props: Record<string, unknown>): React.JSX.Element {
  const C = (getEnrollmentsHost() as any).PinnedWidgets as React.ComponentType<any>;
  return C ? <C {...props} /> : <></>;
}

export function ReportChartCard(props: Record<string, unknown>): React.JSX.Element {
  const C = (getEnrollmentsHost() as any).ReportChartCard as React.ComponentType<any>;
  return C ? <C {...props} /> : <>{props.children as React.ReactNode}</>;
}
