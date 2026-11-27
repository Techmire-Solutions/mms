import React from "react";
import { getQuestionBankHost } from "../host.js";

export function ReportChartCard(props: any): React.JSX.Element {
  const C = (getQuestionBankHost() as any).ReportChartCard as React.ComponentType<any>;
  return <C {...props} />;
}

export default ReportChartCard;

export function ReportDataGridContainer(props: any): React.JSX.Element {
  const C = (getQuestionBankHost() as any).ReportDataGridContainer as React.ComponentType<any>;
  return <C {...props} />;
}
