import React, { type ReactElement, type ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { SectionLabel } from "@/components/app/SectionLabel";
import { Badge } from "@/components/ui/badge";
import { WORK_SURFACE } from "@/components/ui/formStyles";
import { cn } from "@/lib/utils";

export interface EntityCardsSelectAllBarProps {
  checkboxId: string;
  allSelected: boolean;
  someSelected: boolean;
  onSelectAll: () => void;
  selectLabel: string;
  deselectLabel: string;
  selectedCount: number;
  selectedCountLabel: ReactNode;
  pageCountLabel: ReactNode;
  className?: string;
}

/** Shared Work cards select-all strip (Contacts / Students SSOT). */
export const DirectoryCardsSelectAllBar = React.memo(function DirectoryCardsSelectAllBar({
  checkboxId,
  allSelected,
  someSelected,
  onSelectAll,
  selectLabel,
  deselectLabel,
  selectedCount,
  selectedCountLabel,
  pageCountLabel,
  className,
}: EntityCardsSelectAllBarProps): ReactElement {
  return (
    <div
      className={cn(
        WORK_SURFACE,
        "mb-3.5 flex items-center justify-between border-border/40 px-4 py-3",
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex min-h-11 min-w-11 items-center justify-center">
          <Checkbox
            checked={someSelected ? "indeterminate" : allSelected}
            onCheckedChange={onSelectAll}
            id={checkboxId}
          />
        </div>
        <SectionLabel
          as="label"
          htmlFor={checkboxId}
          tracking="wider"
          className="select-none cursor-pointer hover:text-foreground transition-colors"
        >
          {allSelected ? deselectLabel : selectLabel}
        </SectionLabel>
      </div>
      <Badge
        pill
        tone="muted"
        className="font-black uppercase tracking-wider bg-muted/60 px-2.5 py-1 border-border/10"
      >
        {selectedCount > 0 ? (
          <>
            {selectedCountLabel}
            <span className="mx-1.5 text-border" aria-hidden="true">
              ·
            </span>
            {pageCountLabel}
          </>
        ) : (
          pageCountLabel
        )}
      </Badge>
    </div>
  );
});
