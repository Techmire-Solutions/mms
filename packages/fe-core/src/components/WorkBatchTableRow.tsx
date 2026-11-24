import React from "react";
import { m } from "framer-motion";
import { TableCell, TableRow } from "@mms/ui";
import { ModuleTableSelectionCell } from "./ModuleTableSelectionCell";
import { workTableRowBg, workTableStickyCellBg } from "@mms/ui/app/tableWorkSticky";
import { cn } from "@mms/ui";
import { WORK_TABLE_ACTIONS_WIDTH_CLASS } from "./workBatchTableWidths";
import type { ListRowMotionFn } from "@mms/fe-core/hooks";
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
  onSelectRange?: (id: string | number) => void;
  selectRowAriaLabel?: (row: TData) => string;
  columns: WorkBatchTableColumn<TData>[];
  /** Cumulative `inset-inline-start` offsets (px) keyed by left-pinned column id. */
  stickyLeftOffsets?: Record<string, number>;
  /** Cumulative `inset-inline-end` offsets (px) keyed by right-pinned column id. */
  stickyRightOffsets?: Record<string, number>;
  rowHeaderColumnId?: string;
  renderRowActions?: (row: TData, rowIndex: number) => React.ReactNode;
  actionsCellClassName?: string;
  /** Data/selection/actions cell padding override (row density). Defaults to `px-4 py-3`. */
  cellPaddingClass?: string;
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
    onSelectRange,
    selectRowAriaLabel,
    columns,
    stickyLeftOffsets,
    stickyRightOffsets,
    rowHeaderColumnId,
    renderRowActions,
    actionsCellClassName,
    cellPaddingClass = "px-4 py-3",
  } = props;

  const idStr = String(row.id);
  const rowAriaLabel = selectRowAriaLabel ? selectRowAriaLabel(row) : `Select row ${idStr}`;

  const hasNestedInteractive = hasSelection || Boolean(renderRowActions);
  // Clickable <tr role="button"> wrapping checkboxes/switches fails axe nested-interactive.
  // Keep mouse click activation; keyboard users use the selection control / row actions.
  // The onClick guard ignores clicks on nested controls so row activation never double-fires
  // against a name button, checkbox, or inline quick action.
  const trProps = {
    onClick: onRowClick
      ? (e: React.MouseEvent) => {
          const target = e.target as HTMLElement;
          if (
            target.closest(
              'button, a, input, select, textarea, [contenteditable="true"], [role="button"], [role="checkbox"], [role="switch"], [role="menuitem"], [role="link"]',
            )
          ) {
            return;
          }
          onRowClick(row);
        }
      : undefined,
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
      "group border-b border-border/40 transition-colors",
      workTableRowBg(isSelected),
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
          onShiftSelect={onSelectRange ? () => onSelectRange(row.id) : undefined}
          ariaLabel={rowAriaLabel}
          stopPropagation={Boolean(onRowClick)}
          paddingClassName={cellPaddingClass}
        />
      )}

      {/* Columns */}
      {columns.map((col) => {
        const leftOffset = stickyLeftOffsets?.[col.id];
        const rightOffset = stickyRightOffsets?.[col.id];
        const isStickyStart = leftOffset !== undefined;
        const isStickyEnd = rightOffset !== undefined;
        const isRowHeader = Boolean(rowHeaderColumnId && rowHeaderColumnId === col.id);
        const customCellClass =
          typeof col.cellClassName === "function" ? col.cellClassName(row) : col.cellClassName;

        return (
          <TableCell
            key={col.id}
            noWrap={col.noWrap}
            truncate={col.truncate}
            align={col.align}
            variant={col.variant}
            asHeader={isRowHeader}
            style={
              isStickyStart || isStickyEnd
                ? { insetInlineStart: leftOffset, insetInlineEnd: rightOffset }
                : undefined
            }
            className={cn(
              // overflow-hidden: a cell never paints over its neighbours when content outgrows the column.
              cellPaddingClass,
              "text-sm text-foreground transition-colors text-wrap break-words overflow-hidden",
              isStickyStart && "sticky z-elevated border-e border-border/30",
              isStickyEnd && "sticky z-elevated border-s border-border/30",
              isStickyStart || isStickyEnd ? workTableStickyCellBg(isSelected) : undefined,
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
          className={cn(
            // Sticky end-edge mirrors the sticky start identity column so the primary
            // record actions stay reachable while the table scrolls horizontally.
            cellPaddingClass,
            "text-end sticky end-0 z-elevated border-s border-border/30",
            workTableStickyCellBg(isSelected),
            actionsCellClassName ?? WORK_TABLE_ACTIONS_WIDTH_CLASS,
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {renderRowActions(row, rowIndex)}
        </TableCell>
      )}
    </>
  );

  const motionProps = isMotion && rowMotion ? rowMotion(rowIndex * 0.02) : undefined;

  return isMotion ? (
    <m.tr key={idStr} {...motionProps} {...trProps}>
      {cells}
    </m.tr>
  ) : (
    <TableRow key={idStr} {...trProps}>
      {cells}
    </TableRow>
  );
}

export const WorkBatchTableRow = React.memo(
  WorkBatchTableRowComponent,
) as typeof WorkBatchTableRowComponent;
