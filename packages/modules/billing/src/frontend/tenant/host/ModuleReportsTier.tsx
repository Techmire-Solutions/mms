import React from "react";
import { useFinanceHostValue } from "../host.js";

export default function ModuleReportsTier(props: Record<string, unknown>): React.JSX.Element {
  const C = (useFinanceHostValue() as any).ModuleReportsTier as React.ComponentType<any>;
  return <C {...props} />;
}
