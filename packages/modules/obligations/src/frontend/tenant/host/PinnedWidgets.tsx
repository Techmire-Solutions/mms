import React from "react";
import { getObligationsHost } from "../host.js";

export function PinnedWidgets(props: any): React.JSX.Element {
  const C = (getObligationsHost() as any).PinnedWidgets as React.ComponentType<any>;
  return <C {...props} />;
}

export default PinnedWidgets;
