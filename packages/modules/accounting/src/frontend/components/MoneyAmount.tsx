import React from "react";
import { formatMoney } from "@mms/contracts";

export interface MoneyAmountProps {
  amount: number | string | null | undefined;
  currency: string;
  decimalPlaces?: number;
  className?: string;
}

/** Accounting-shared money renderer; formatting stays in contracts to avoid float drift. */
export function MoneyAmount({
  amount,
  currency,
  decimalPlaces,
  className,
}: MoneyAmountProps): React.JSX.Element {
  const value = formatMoney(amount, currency, {
    useSymbol: true,
    ...(decimalPlaces === undefined
      ? {}
      : { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces }),
  });
  return <span className={className}>{value}</span>;
}
