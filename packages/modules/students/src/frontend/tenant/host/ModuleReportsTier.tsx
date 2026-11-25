import React from "react";
import { getStudentsHost } from "../host.js";

export function ModuleReportsTier(props: Record<string, unknown>): React.JSX.Element {
  const C = (getStudentsHost() as any).ModuleReportsTier as React.ComponentType<any>;
  return <C {...props} />;
}

export default ModuleReportsTier;
