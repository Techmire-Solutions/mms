import React from "react";
import { useFinanceHostValue } from "../host.js";

export function UserActorSelect(props: Record<string, unknown>): React.JSX.Element {
  const C = useFinanceHostValue().UserActorSelect;
  return <C {...props} />;
}

export default UserActorSelect;
