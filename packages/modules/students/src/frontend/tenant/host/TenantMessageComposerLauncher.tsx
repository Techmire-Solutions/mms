import React from "react";
import { getStudentsHost } from "../host.js";

export function TenantMessageComposerLauncher(props: Record<string, unknown>): React.JSX.Element {
  const C = (getStudentsHost() as any).TenantMessageComposerLauncher as React.ComponentType<any>;
  return <C {...props} />;
}

export default TenantMessageComposerLauncher;
