import React from "react";
import { getIamHost } from "../host.js";

export function ReportDataGridContainer(props: Record<string, unknown>): React.JSX.Element {
  const C = (getIamHost() as any).ReportDataGridContainer as React.ComponentType<any>;
  return <C {...props} />;
}

export default ReportDataGridContainer;
