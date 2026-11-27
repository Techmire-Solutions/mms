import React from "react";
import { getAccountingHost } from "../host.js";

export interface RegistryPersonSelectProps {
  kind?: string;
  id?: string;
  name?: string;
  label?: string;
  searchLabel?: string;
  searchPlaceholder?: string;
  value?: string;
  onChange?: (id: string, name?: string) => void;
  onPick?: (id: string, name?: string) => void;
  [key: string]: unknown;
}

export function RegistryPersonSelect(props: RegistryPersonSelectProps): React.JSX.Element {
  const Component = getAccountingHost()
    .RegistryPersonSelect as React.ComponentType<RegistryPersonSelectProps>;
  return <Component {...props} />;
}

export default RegistryPersonSelect;
