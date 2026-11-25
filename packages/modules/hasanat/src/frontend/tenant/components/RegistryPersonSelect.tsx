import React from "react";
import { useHasanatHost } from "../host.js";

export function RegistryPersonSelect(props: any): React.JSX.Element {
  const C = useHasanatHost().RegistryPersonSelect;
  return <C {...props} />;
}
