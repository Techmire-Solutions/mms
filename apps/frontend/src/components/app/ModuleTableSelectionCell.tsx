import React, { type JSX } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { TableCell } from "@/components/ui/table";
import { workTableStickyCellBg } from "@/components/app/tableWorkSticky";
import { cn } from "@/lib/utils";

export interface ModuleTableSelectionCellProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  ariaLabel: string;
  sticky?: boolean;
  className?: string;
  stopPropagation?: boolean;
  onClick?: (e: React.MouseEvent<HTMLTableCellElement>) => void;
  /** Called instead of the single-row toggle when the user shift-clicks (range select). */
  onShiftSelect?: () => void;
  /** Padding override (row density). Defaults to `px-4 py-3`. */
  paddingClassName?: string;
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
  onShiftSelect,
  paddingClassName = "px-4 py-3",
}: ModuleTableSelectionCellProps): JSX.Element {
  // Shift is captured on pointer-down (fires before Radix's click-driven
  // `onCheckedChange`), so the single-row toggle is suppressed on shift+click and
  // the range-select callback runs instead. Keyboard toggles never set this ref.
  const shiftRef = React.useRef(false);

  const handleCheckedChange = (next: boolean) => {
    if (shiftRef.current) {
      shiftRef.current = false;
      onShiftSelect?.();
      return;
    }
    onCheckedChange(next);
  };

  const handleClick = (e: React.MouseEvent<HTMLTableCellElement>) => {
    if (stopPropagation) {
      e.stopPropagation();
    }
    const target = e.target as HTMLElement;
    if (!target.closest('button[role="checkbox"], input')) {
      if (e.shiftKey && onShiftSelect) {
        onShiftSelect();
      } else {
        onCheckedChange(!checked);
      }
    }
    onClick?.(e);
  };

  return (
    <TableCell
      noWrap
      onClick={handleClick}
      className={cn(
        "w-12 min-w-12 transition-colors cursor-pointer",
        paddingClassName,
        sticky && "sticky start-0 z-sticky border-e border-border/30",
        sticky ? workTableStickyCellBg(checked) : undefined,
        className,
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={handleCheckedChange}
        onPointerDown={(e) => {
          shiftRef.current = e.shiftKey;
        }}
        aria-label={ariaLabel}
      />
    </TableCell>
  );
});
