import React from "react";
import { useFinanceHostValue } from "../host.js";

export function ModuleReportsTier(props: Record<string, unknown>): React.JSX.Element {
  const C = useFinanceHostValue().ModuleReportsTier;
  return <C {...props} />;
}
