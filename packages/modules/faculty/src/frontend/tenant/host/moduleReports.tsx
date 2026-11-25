import React from "react";
import { useFacultyHost } from "../host.js";

export function ModuleReports(props: Record<string, unknown>): React.JSX.Element {
  const C = useFacultyHost().ModuleReports;
  return <C {...props} />;
}

export function KPISummary(props: Record<string, unknown>): React.JSX.Element {
  const C = useFacultyHost().KPISummary;
  return <C {...props} />;
}
