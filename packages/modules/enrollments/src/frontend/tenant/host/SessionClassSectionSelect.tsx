import React from "react";
import { getEnrollmentsHost } from "../host.js";

export function SessionClassSectionSelect(props: Record<string, unknown>): React.JSX.Element {
  const C = (getEnrollmentsHost() as any).SessionClassSectionSelect as React.ComponentType<any>;
  return <C {...props} />;
}

export default SessionClassSectionSelect;

export type SessionClassSectionValue = any;
