import React from "react";
import { getSessionsHost } from "../host.js";

export function ModuleReportsTier(props: Record<string, unknown>): React.JSX.Element {
  const C = (getSessionsHost() as any).ModuleReportsTier as React.ComponentType<any>;
  return <C {...props} />;
}

export default ModuleReportsTier;
