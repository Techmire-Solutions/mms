import React from "react";
import { getAttendanceHost } from "../host.js";

export function WorkTaskToolbar(props: Record<string, unknown>): React.JSX.Element {
  const C = (getAttendanceHost() as any).WorkTaskToolbar as React.ComponentType<any>;
  return <C {...props} />;
}

export default WorkTaskToolbar;
