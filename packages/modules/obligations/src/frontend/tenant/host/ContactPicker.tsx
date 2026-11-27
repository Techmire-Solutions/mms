import React from "react";
import { getObligationsHost } from "../host.js";

export function ContactPicker(props: any): React.JSX.Element {
  const C = (getObligationsHost() as any).ContactPicker as React.ComponentType<any>;
  return <C {...props} />;
}

export default ContactPicker;
