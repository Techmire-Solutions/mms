import React from "react";
import { getEnrollmentsHost } from "../host.js";

export function RegistryPersonSelect(props: Record<string, unknown>): React.JSX.Element {
  const C = (getEnrollmentsHost() as any).RegistryPersonSelect as React.ComponentType<any>;
  return <C {...props} />;
}

export default RegistryPersonSelect;
