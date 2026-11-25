import React from "react";
import { getEnrollmentsHost } from "../host.js";

export function PinnedWidgets(props: Record<string, unknown>): React.JSX.Element {
  const C = (getEnrollmentsHost() as any).PinnedWidgets as React.ComponentType<any>;
  return <C {...props} />;
}

export default PinnedWidgets;
