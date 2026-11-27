import React from "react";
import { getExaminationsHost } from "../host.js";

export function KPISummary(props: any): React.JSX.Element {
  const C = (getExaminationsHost() as any).KPISummary as React.ComponentType<any>;
  return <C {...props} />;
}

export default KPISummary;
