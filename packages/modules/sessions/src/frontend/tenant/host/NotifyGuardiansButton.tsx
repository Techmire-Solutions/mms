import React from "react";
import { getSessionsHost } from "../host.js";

export function NotifyGuardiansButton(props: Record<string, unknown>): React.JSX.Element {
  const C = (getSessionsHost() as any).NotifyGuardiansButton as React.ComponentType<any>;
  return <C {...props} />;
}

export default NotifyGuardiansButton;
