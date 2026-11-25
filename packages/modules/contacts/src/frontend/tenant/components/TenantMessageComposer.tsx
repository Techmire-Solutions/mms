import React from "react";
import { useContactsHost } from "../host.js";

/** Renders the app-provided tenant message composer (host-wired at render time). */
export default function TenantMessageComposer(props: Record<string, unknown>): React.JSX.Element {
  const { TenantMessageComposer: HostComposer } = useContactsHost();
  return <HostComposer {...props} />;
}
