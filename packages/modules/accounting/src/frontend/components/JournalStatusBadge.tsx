import React from "react";
import { Badge, type BadgeTone } from "@mms/ui";
import type { JournalEntry } from "@mms/contracts";

const TONE: Record<string, BadgeTone> = {
  draft: "muted",
  posted: "success",
  reversed: "warning",
};

export function JournalStatusBadge({
  status,
}: {
  status: JournalEntry["status"];
}): React.JSX.Element {
  return (
    <Badge as="span" size="sm" tone={TONE[status] ?? "muted"}>
      {status}
    </Badge>
  );
}
