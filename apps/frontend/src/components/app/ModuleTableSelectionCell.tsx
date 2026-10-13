import React, { type JSX } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { TableCell } from "@/components/ui/table";
import { workTableStickyCellBg } from "@/components/ui/tableWorkSticky";
import { cn } from "@/lib/utils";

export interface ModuleTableSelectionCellProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  ariaLabel: string;
  sticky?: boolean;
  className?: string;
  stopPropagation?: boolean;
  onClick?: (e: React.MouseEvent<HTMLTableCellElement>) => void;
}

/** Shared selection checkbox table cell matching ModuleWorkTableHeader sticky layout. */
export const ModuleTableSelectionCell = React.memo(function ModuleTableSelectionCell({
  checked,
  onCheckedChange,
  ariaLabel,
  sticky = true,
  className,
  stopPropagation = false,
  onClick,
}: ModuleTableSelectionCellProps): JSX.Element {
  const handleClick = (e: React.MouseEvent<HTMLTableCellElement>) => {
    if (stopPropagation) {
      e.stopPropagation();
    }
    onClick?.(e);
  };

  return (
    <TableCell
      noWrap
      onClick={stopPropagation || onClick ? handleClick : undefined}
      className={cn(
        "w-12 min-w-12 px-4 py-3 transition-colors",
        sticky && "sticky start-0 z-sticky border-e border-border/30",
        sticky ? workTableStickyCellBg(checked) : undefined,
        className,
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(val) => onCheckedChange(val === true)}
        aria-label={ariaLabel}
      />
    </TableCell>
  );
});
