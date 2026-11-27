import type React from "react";
import { type Account } from "@mms/contracts";
import type { MoneySeparator } from "../hooks/accountingMoneyParsers";
import { AccountingBankRecSection } from "./AccountingBankRecSection";

export interface AccountingBankingPanelProps {
  accounts: Account[];
  decimalSeparator: MoneySeparator;
  canWrite: boolean;
}

/**
 * Banking tab on the Accounting tier: bank statements & reconciliation.
 */
export function AccountingBankingPanel({
  accounts,
  decimalSeparator,
  canWrite,
}: AccountingBankingPanelProps): React.JSX.Element {
  return (
    <div className="space-y-6">
      <AccountingBankRecSection
        accounts={accounts}
        decimalSeparator={decimalSeparator}
        canEdit={canWrite}
      />
    </div>
  );
}
