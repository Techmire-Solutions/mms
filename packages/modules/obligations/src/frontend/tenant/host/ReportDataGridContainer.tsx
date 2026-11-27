import React from "react";
import { getObligationsHost } from "../host.js";

export function ReportDataGridContainer(props: any): React.JSX.Element {
  const C = (getObligationsHost() as any).ReportDataGridContainer as React.ComponentType<any>;
  return <C {...props} />;
}

export default ReportDataGridContainer;
