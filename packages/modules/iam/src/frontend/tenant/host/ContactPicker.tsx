import React from "react";
import { getIamHost } from "../host.js";

export function ContactPicker(props: Record<string, unknown>): React.JSX.Element {
  const C = (getIamHost() as any).ContactPicker as React.ComponentType<any>;
  return <C {...props} />;
}

export default ContactPicker;
