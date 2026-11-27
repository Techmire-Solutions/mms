import React from "react";
import { getObligationsHost } from "../host.js";

export function UserActorSelect(props: any): React.JSX.Element {
  const C = (getObligationsHost() as any).UserActorSelect as React.ComponentType<any>;
  return <C {...props} />;
}

export default UserActorSelect;
