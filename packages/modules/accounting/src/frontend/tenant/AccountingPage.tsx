import React from "react";
import { Card } from "@mms/ui";
import { MoneyAmount } from "../components/MoneyAmount";

export interface AccountingPageProps {
  /** App-owned reports contribution; the module must not import the app report registry. */
  reportsTier?: React.ComponentType;
}

/**
 * Module-owned accounting page shell. The full work/setup tiers are migrated
 * incrementally from the app feature; the page contract is stable for the app
 * route registry.
 */
export function AccountingPage({
  reportsTier: ReportsTier,
}: AccountingPageProps): React.JSX.Element {
  return (
    <Card className="space-y-2 p-4">
      <h1 className="text-lg font-semibold">Accounting</h1>
      <p className="text-sm text-muted-foreground">
        Ledger, chart of accounts, journal entries, fiscal years and consolidation.
      </p>
      <MoneyAmount amount={0} currency="USD" />
      {ReportsTier ? <ReportsTier /> : null}
    </Card>
  );
}
