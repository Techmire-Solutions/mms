import React from "react";
import { getAnalyticsHost } from "../host.js";

export function MessagingReportsVolumeChart(props: any): React.JSX.Element {
  const C = (getAnalyticsHost() as any).MessagingReportsVolumeChart as React.ComponentType<any>;
  return <C {...props} />;
}

export default MessagingReportsVolumeChart;
