import React from "react";
import { getAccountingHost } from "../host.js";

export function PinnedWidgets(props: Record<string, unknown>): React.JSX.Element {
  const Component = getAccountingHost().PinnedWidgets;
  return <Component {...props} />;
}

export default PinnedWidgets;
