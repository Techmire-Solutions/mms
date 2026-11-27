import React from "react";
import { getAccountingHost } from "../host.js";

export function MutedTableHeaderRow(props: Record<string, unknown>): React.JSX.Element {
  const Component = getAccountingHost().MutedTableHeaderRow;
  return <Component {...props} />;
}

export default MutedTableHeaderRow;
