import React from "react";
import { Badge, type BadgeTone } from "@mms/ui";
import type { Account } from "@mms/contracts";

const TONE: Record<Account["type"], BadgeTone> = {
  Asset: "info",
  Liability: "destructive",
  Equity: "primary",
  Revenue: "success",
  Expense: "warning",
};

export function AccountTypeBadge({ type }: { type: Account["type"] }): React.JSX.Element {
  return (
    <Badge as="span" size="sm" tone={TONE[type]}>
      {type}
    </Badge>
  );
}
