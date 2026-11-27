import React from "react";
import { getObligationsHost } from "../host.js";

export function MessageComposer(props: any): React.JSX.Element {
  const C = (getObligationsHost() as any).MessageComposer as React.ComponentType<any>;
  return <C {...props} />;
}

export default MessageComposer;

export type MessageComposerProps = Record<string, any>;
