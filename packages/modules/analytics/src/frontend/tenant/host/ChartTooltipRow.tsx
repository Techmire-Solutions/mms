import React from "react";
import { getAnalyticsHost } from "../host.js";

export function ChartTooltipRow(props: any): React.JSX.Element {
  const C = (getAnalyticsHost() as any).ChartTooltipRow as React.ComponentType<any>;
  return <C {...props} />;
}

export default ChartTooltipRow;
