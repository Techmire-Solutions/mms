import React from "react";
import { useMessagingHost } from "../host.js";

export default function TenantMessageComposer(props: Record<string, unknown>): React.JSX.Element {
  const C = useMessagingHost().TenantMessageComposer;
  return <C {...props} />;
}
