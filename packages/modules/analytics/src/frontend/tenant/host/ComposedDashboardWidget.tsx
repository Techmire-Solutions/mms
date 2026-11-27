import React from "react";
import { getAnalyticsHost } from "../host.js";

export function ComposedDashboardWidget(props: any): React.JSX.Element {
  const C = (getAnalyticsHost() as any).dashboardWidgetRegistry?.ComposedDashboardWidget as
    React.ComponentType<any> | undefined;
  if (!C) return <></>;
  return <C {...props} />;
}

export default ComposedDashboardWidget;
