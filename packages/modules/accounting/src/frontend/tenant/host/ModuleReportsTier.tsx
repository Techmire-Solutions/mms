import React from "react";
import { getAccountingHost } from "../host.js";

/** App-owned Reports tier surface injected into the module page. */
export function ModuleReportsTier(props: Record<string, unknown>): React.JSX.Element {
  const Component = getAccountingHost().ModuleReportsTier;
  return <Component {...props} />;
}

export default ModuleReportsTier;
