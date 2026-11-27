import React from "react";
import { getAccountingHost } from "../host.js";

export function FinancialDebitCreditTableChrome(props: Record<string, unknown>): React.JSX.Element {
  const Component = getAccountingHost().FinancialDebitCreditTableChrome;
  return <Component {...props} />;
}

export default FinancialDebitCreditTableChrome;

export { MutedTableHeaderRow } from "./MutedTableHeaderRow.js";
