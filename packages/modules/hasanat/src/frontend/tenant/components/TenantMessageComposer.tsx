import React from "react";
import { useHasanatHost } from "../host.js";

/** Renders the app-provided tenant message composer (host-wired at render time). */
export default function TenantMessageComposer(props: Record<string, unknown>): React.JSX.Element {
  const { TenantMessageComposer: HostComposer } = useHasanatHost();
  return <HostComposer {...props} />;
}
