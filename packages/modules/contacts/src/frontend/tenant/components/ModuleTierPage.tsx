import React from "react";
import { useContactsHost } from "../host.js";

export type { ModuleTierPageSpec } from "../host.js";

/** Renders the app-provided tier-page scaffold (routing-aware fallback stays app-side). */
export function ModuleTierPage(props: Record<string, unknown>): React.JSX.Element {
  const { ModuleTierPage: HostPage } = useContactsHost();
  return <HostPage {...props} />;
}
