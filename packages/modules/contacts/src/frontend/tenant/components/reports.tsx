import React from "react";
import { useContactsHost } from "../host.js";

/** Renders the app-provided shared module Reports tier. */
export function ModuleReportsTier(props: Record<string, unknown>): React.JSX.Element {
  const { ModuleReportsTier: HostTier } = useContactsHost();
  return <HostTier {...props} />;
}
