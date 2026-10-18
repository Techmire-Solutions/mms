import React from "react";
import { motion } from "framer-motion";
import { TableCell, TableRow } from "@/components/ui/table";
import { ModuleTableSelectionCell } from "@/components/app/ModuleTableSelectionCell";
import { workTableStickyCellBg } from "@/components/app/tableWorkSticky";
import { cn } from "@/lib/utils";
import type { ListRowMotionFn } from "@/hooks/useListRowMotion";
import type { WorkBatchTableColumn } from "./WorkBatchTable";

export interface WorkBatchTableRowProps<TData extends { id: string | number }> {
  row: TData;
  rowIndex: number;
  isMotion: boolean;
  isSelected: boolean;
  rowMotion?: ListRowMotionFn;
  onRowClick?: (row: TData) => void;
  onRowHover?: (row: TData) => void;
  rowClassName?: (row: TData) => string | undefined;
  hasSelection: boolean;
  onSelectOne?: (id: string) => void;
  selectRowAriaLabel?: (row: TData) => string;
  columns: WorkBatchTableColumn<TData>[];
  stickyColumnId?: string;
  renderRowActions?: (row: TData, rowIndex: number) => React.ReactNode;
  actionsCellClassName?: string;
}

function WorkBatchTableRowComponent<TData extends { id: string | number }>(
  props: WorkBatchTableRowProps<TData>,
): React.JSX.Element {
  const {
    row,
    rowIndex,
    isMotion,
    isSelected,
    rowMotion,
    onRowClick,
    onRowHover,
    rowClassName,
    hasSelection,
    onSelectOne,
    selectRowAriaLabel,
    columns,
    stickyColumnId,
    renderRowActions,
    actionsCellClassName,
  } = props;

  const idStr = String(row.id);
  const rowAriaLabel = selectRowAriaLabel ? selectRowAriaLabel(row) : `Select row ${idStr}`;

  const hasNestedInteractive = hasSelection || Boolean(renderRowActions);
  // Clickable <tr role="button"> wrapping checkboxes/switches fails axe nested-interactive.
  // Keep mouse click activation; keyboard users use the selection control / row actions.
  const trProps = {
    onClick: () => onRowClick?.(row),
    onKeyDown:
      onRowClick && !hasNestedInteractive
        ? (e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onRowClick(row);
            }
          }
        : undefined,
    tabIndex: onRowClick && !hasNestedInteractive ? 0 : undefined,
    role: onRowClick && !hasNestedInteractive ? ("button" as const) : undefined,
    onMouseEnter: onRowHover ? () => onRowHover(row) : undefined,
    className: cn(
      "group border-b border-border/40 transition-colors hover:bg-muted/40",
      isSelected && "bg-accent/15",
      onRowClick && "cursor-pointer",
      rowClassName?.(row),
    ),
  };

  const cells = (
    <>
      {/* Selectable Row Checkbox */}
      {hasSelection && onSelectOne && (
        <ModuleTableSelectionCell
          checked={isSelected}
          onCheckedChange={() => onSelectOne(idStr)}
          ariaLabel={rowAriaLabel}
          stopPropagation={Boolean(onRowClick)}
        />
      )}

      {/* Columns */}
      {columns.map((col) => {
        const isSticky = stickyColumnId === col.id;
        const customCellClass =
          typeof col.cellClassName === "function" ? col.cellClassName(row) : col.cellClassName;

        return (
          <TableCell
            key={col.id}
            noWrap={col.noWrap}
            truncate={col.truncate}
            align={col.align}
            variant={col.variant}
            className={cn(
              "px-4 py-3 text-sm text-foreground transition-colors",
              isSticky && "sticky start-12 z-elevated border-e border-border/30",
              isSticky ? workTableStickyCellBg(isSelected) : undefined,
              customCellClass,
            )}
          >
            {col.render(row, rowIndex)}
          </TableCell>
        );
      })}

      {/* Actions Menu */}
      {renderRowActions && (
        <TableCell
          noWrap
          className={cn("text-end", actionsCellClassName ?? "w-12 min-w-12 px-2 py-3")}
          onClick={(e) => e.stopPropagation()}
        >
          {renderRowActions(row, rowIndex)}
        </TableCell>
      )}
    </>
  );

  const motionProps = isMotion && rowMotion ? rowMotion(rowIndex * 0.02) : undefined;

  return isMotion ? (
    <motion.tr key={idStr} {...motionProps} {...trProps}>
      {cells}
    </motion.tr>
  ) : (
    <TableRow key={idStr} {...trProps}>
      {cells}
    </TableRow>
  );
}

export const WorkBatchTableRow = React.memo(
  WorkBatchTableRowComponent,
) as typeof WorkBatchTableRowComponent;
