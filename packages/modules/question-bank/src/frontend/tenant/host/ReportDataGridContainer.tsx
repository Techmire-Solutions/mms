import React from "react";
import { getQuestionBankHost } from "../host.js";

export function ReportDataGridContainer(props: any): React.JSX.Element {
  const C = (getQuestionBankHost() as any).ReportDataGridContainer as React.ComponentType<any>;
  return <C {...props} />;
}

export default ReportDataGridContainer;
