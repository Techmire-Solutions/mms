import React from "react";
import { getAttendanceHost } from "../host.js";

export function SessionClassSectionSelect(props: Record<string, unknown>): React.JSX.Element {
  const C = (getAttendanceHost() as any).SessionClassSectionSelect as React.ComponentType<any>;
  return <C {...props} />;
}

export default SessionClassSectionSelect;
