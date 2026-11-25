import React from "react";
import { useFacultyHost } from "../host.js";

export default function TenantMessageComposer(props: Record<string, unknown>): React.JSX.Element {
  const C = useFacultyHost().TenantMessageComposer;
  return <C {...props} />;
}
