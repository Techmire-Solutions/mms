import React from "react";
import { getObligationsHost } from "../host.js";

export function ReportChartCard(props: any): React.JSX.Element {
  const C = (getObligationsHost() as any).ReportChartCard as React.ComponentType<any>;
  return <C {...props} />;
}

export default ReportChartCard;
