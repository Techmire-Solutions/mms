import React from "react";
import { getAnalyticsHost } from "../host.js";

export function SessionsTable(props: any): React.JSX.Element {
  const C = (getAnalyticsHost() as any).SessionsTable as React.ComponentType<any>;
  return <C {...props} />;
}

export default SessionsTable;
