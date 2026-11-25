import React from "react";
import { getStudentsHost } from "../host.js";

export function ContactEditModal(props: Record<string, unknown>): React.JSX.Element {
  const C = (getStudentsHost() as any).ContactEditModal as React.ComponentType<any>;
  return <C {...props} />;
}

export default ContactEditModal;
