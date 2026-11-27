import React from "react";
import { getExaminationsHost } from "../host.js";

export function ModuleReports(props: any): React.JSX.Element {
  const C = (getExaminationsHost() as any).ModuleReports as React.ComponentType<any>;
  return <C {...props} />;
}

export default ModuleReports;

export function KPISummary(props: any): React.JSX.Element {
  const C = (getExaminationsHost() as any).KPISummary as React.ComponentType<any>;
  return <C {...props} />;
}
