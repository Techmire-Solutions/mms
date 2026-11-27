import React from "react";
import { getAnalyticsHost } from "../host.js";

export function DashboardWidgetsView(props: any): React.JSX.Element {
  const C = (getAnalyticsHost() as any).reportLibs?.["DashboardWidgets"] as
    React.ComponentType<any> | undefined;
  if (!C) return <></>;
  return <C {...props} />;
}

export default DashboardWidgetsView;
