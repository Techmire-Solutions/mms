import React from "react";
import { getEnrollmentsHost } from "../host.js";

export function NotifyGuardiansButton(props: Record<string, unknown>): React.JSX.Element {
  const C = (getEnrollmentsHost() as any).NotifyGuardiansButton as React.ComponentType<any>;
  return <C {...props} />;
}

export default NotifyGuardiansButton;
