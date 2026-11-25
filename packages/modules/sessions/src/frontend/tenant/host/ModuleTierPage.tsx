import React from "react";
import { getSessionsHost } from "../host.js";

export function ModuleTierPage(props: Record<string, unknown>): React.JSX.Element {
  const C = (getSessionsHost() as any).ModuleTierPage as React.ComponentType<any>;
  return <C {...props} />;
}

export default ModuleTierPage;
