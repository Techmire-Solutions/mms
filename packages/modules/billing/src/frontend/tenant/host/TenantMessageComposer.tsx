import React from "react";
import { useFinanceHostValue } from "../host.js";

export default function TenantMessageComposer(props: Record<string, unknown>): React.JSX.Element {
  const C = (useFinanceHostValue() as any).TenantMessageComposer as React.ComponentType<any>;
  return <C {...props} />;
}
