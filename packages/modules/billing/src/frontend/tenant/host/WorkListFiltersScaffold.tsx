import React from "react";
import { useFinanceHostValue } from "../host.js";

export type WorkListFilterChip = Record<string, unknown>;

export function WorkListFiltersScaffold(props: Record<string, unknown>): React.JSX.Element {
  const C = useFinanceHostValue().WorkListFiltersScaffold;
  return <C {...props} />;
}

export default WorkListFiltersScaffold;
