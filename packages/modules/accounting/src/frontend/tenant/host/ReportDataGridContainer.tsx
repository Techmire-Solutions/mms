import React from "react";
import { getAccountingHost } from "../host.js";

export function ReportDataGridContainer(props: Record<string, unknown>): React.JSX.Element {
  const Component = getAccountingHost().ReportDataGridContainer;
  return <Component {...props} />;
}

export default ReportDataGridContainer;
