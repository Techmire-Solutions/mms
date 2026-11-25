import React from "react";
import { getStudentsHost } from "../host.js";

export interface ModuleTierPageSpec {
  [key: string]: unknown;
}

export function ModuleTierPage(props: Record<string, unknown>): React.JSX.Element {
  const C = (getStudentsHost() as any).ModuleTierPage as React.ComponentType<any>;
  return <C {...props} />;
}

export default ModuleTierPage;
