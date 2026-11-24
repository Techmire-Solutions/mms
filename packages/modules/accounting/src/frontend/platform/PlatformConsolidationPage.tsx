import React from "react";
import { Card } from "@mms/ui";
import { MoneyAmount } from "../components/MoneyAmount";

/** Module-owned platform consolidation entry; app supplies live query/page shell. */
export function PlatformConsolidationPage(): React.JSX.Element {
  return (
    <Card className="p-4">
      <h1 className="text-lg font-semibold">Consolidation</h1>
      <p className="text-sm text-muted-foreground">
        Consolidation groups and translated reports are provided by{" "}
        <code>@mms/mod-accounting/backend/platform</code>.
      </p>
      <MoneyAmount amount={0} currency="USD" />
    </Card>
  );
}
