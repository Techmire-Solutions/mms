import React from "react";
import { getIamHost } from "../host.js";

export function TenantMessageComposerLauncher(props: Record<string, unknown>): React.JSX.Element {
  const C = (getIamHost() as any).TenantMessageComposerLauncher as React.ComponentType<any>;
  return <C {...props} />;
}

export default TenantMessageComposerLauncher;
