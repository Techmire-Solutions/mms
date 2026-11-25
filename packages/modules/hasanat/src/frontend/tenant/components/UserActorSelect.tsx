import React from "react";
import { useHasanatHost } from "../host.js";

export function UserActorSelect(props: any): React.JSX.Element {
  const C = useHasanatHost().UserActorSelect;
  return <C {...props} />;
}
