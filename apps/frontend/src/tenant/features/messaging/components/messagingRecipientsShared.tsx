import React, { type JSX } from "react";
import { SEMANTIC_BG, SEMANTIC_TEXT } from "@/lib/ui/semanticTone";

export function MissingFieldBadge({ label }: { label: string }): JSX.Element {
  return (
    <span
      className={`rounded border border-warning/20 ${SEMANTIC_BG.warning} px-1.5 py-0.5 text-xs ${SEMANTIC_TEXT.warning}`}
    >
      {label}
    </span>
  );
}
