import React from "react";
import { getAnalyticsHost } from "../host.js";

export function ChartTooltip(props: any): React.JSX.Element {
  const C = (getAnalyticsHost() as any).ChartTooltip as React.ComponentType<any>;
  return <C {...props} />;
}

export default ChartTooltip;

export function ChartTooltipRow(props: any): React.JSX.Element {
  const C = (getAnalyticsHost() as any).ChartTooltipRow as React.ComponentType<any>;
  return <C {...props} />;
}
