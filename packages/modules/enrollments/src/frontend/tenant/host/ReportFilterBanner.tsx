import React from "react";
import { getEnrollmentsHost } from "../host.js";

export function ReportFilterBanner(props: Record<string, unknown>): React.JSX.Element {
  const C = (getEnrollmentsHost() as any).ReportFilterBanner as React.ComponentType<any>;
  return <C {...props} />;
}

export default ReportFilterBanner;
