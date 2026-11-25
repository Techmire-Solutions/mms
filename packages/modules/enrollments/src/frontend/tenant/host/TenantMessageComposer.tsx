import React from "react";
import { getEnrollmentsHost } from "../host.js";

export function TenantMessageComposer(props: Record<string, unknown>): React.JSX.Element {
  const C = (getEnrollmentsHost() as any).TenantMessageComposer as React.ComponentType<any>;
  return <C {...props} />;
}

export default TenantMessageComposer;
