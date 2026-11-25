import React from "react";
import { useMessagingHost } from "../host.js";

function wrap(field: keyof import("../host.js").MessagingHostValue) {
  return function Wrapped(props: Record<string, unknown>): React.JSX.Element {
    const C = useMessagingHost()[field] as React.ComponentType<any>;
    return <C {...props} />;
  };
}

export const ModuleReports = wrap("ModuleReports");
export const ModuleReportsTier = wrap("ModuleReportsTier");
export const ReportChartCard = wrap("ReportChartCard");
export const KPISummary = wrap("KPISummary");
