import React from "react";
import { getEnrollmentsHost } from "../host.js";

export type WorkListFilterChip = Record<string, unknown>;

export function WorkListFiltersScaffold(props: Record<string, unknown>): React.JSX.Element {
  const C = (getEnrollmentsHost() as any).WorkListFiltersScaffold as
    React.ComponentType<any> | undefined;
  return C ? <C {...props} /> : <></>;
}

export default WorkListFiltersScaffold;
