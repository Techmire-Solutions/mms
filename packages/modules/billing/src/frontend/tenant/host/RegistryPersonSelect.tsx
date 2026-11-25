import React from "react";
import { useFinanceHostValue } from "../host.js";

export function RegistryPersonSelect(props: Record<string, unknown>): React.JSX.Element {
  const C = useFinanceHostValue().RegistryPersonSelect;
  return <C {...props} />;
}

export default RegistryPersonSelect;
