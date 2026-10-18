import React from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DataTableRowAction {
  id: string;
  /** Accessible name (include the row's name, e.g. "Edit Hadith"). */
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  tone?: "default" | "destructive";
  disabled?: boolean;
  hidden?: boolean;
}

/** Inline icon actions for a table row or card footer (44×44 touch targets). */
export function DataTableRowActions({
  actions,
}: {
  actions: readonly DataTableRowAction[];
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-end gap-1">
      {actions
        .filter((action) => !action.hidden)
        .map(({ id, label, icon: Icon, onClick, tone = "default", disabled }) => (
          <Button
            key={id}
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            title={label}
            className={cn(
              "min-h-11 min-w-11 p-0",
              tone === "destructive"
                ? "hover:bg-destructive/10 hover:text-destructive"
                : "hover:text-primary",
            )}
          >
            <Icon className="size-4" aria-hidden />
          </Button>
        ))}
    </div>
  );
}
