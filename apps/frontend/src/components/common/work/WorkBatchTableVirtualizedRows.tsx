import React, { type JSX } from "react";
import type { VirtualItem } from "@tanstack/react-virtual";
import { TableRow, TableCell } from "@/components/ui/table";
import { WorkBatchTableRow } from "./WorkBatchTableRow";
import type { WorkBatchTableColumn } from "./workBatchTableTypes";

export interface WorkBatchTableVirtualizedRowsProps<TData extends { id: string | number }> {
  virtualItems: VirtualItem[];
  activeRows: readonly TData[];
  selectedSet: Set<string | number>;
  totalColSpan: number;
  totalSize: number;
  columns: WorkBatchTableColumn<TData>[];
  stickyColumnId?: string;
  hasSelection: boolean;
  onSelectOne?: (id: string) => void;
  selectRowAriaLabel?: (row: TData) => string;
  renderRowActions?: (row: TData, index: number) => React.ReactNode;
  actionsCellClassName?: string;
  onRowClick?: (row: TData) => void;
  onRowHover?: (row: TData) => void;
  rowClassName?: (row: TData) => string | undefined;
}

export function WorkBatchTableVirtualizedRows<TData extends { id: string | number }>({
  virtualItems,
  activeRows,
  selectedSet,
  totalColSpan,
  totalSize,
  columns,
  stickyColumnId,
  hasSelection,
  onSelectOne,
  selectRowAriaLabel,
  renderRowActions,
  actionsCellClassName,
  onRowClick,
  onRowHover,
  rowClassName,
}: WorkBatchTableVirtualizedRowsProps<TData>): JSX.Element {
  return (
    <>
      {virtualItems.length > 0 && (
        <TableRow
          style={{ height: `${virtualItems[0].start}px` }}
          className="border-0 hover:bg-transparent"
        >
          <TableCell colSpan={totalColSpan} className="p-0 border-0" />
        </TableRow>
      )}
      {virtualItems.map((virtualRow) => {
        const row = activeRows[virtualRow.index];
        const isSelected = selectedSet.has(row.id) || selectedSet.has(String(row.id));
        return (
          <WorkBatchTableRow
            key={String(row.id)}
            row={row}
            rowIndex={virtualRow.index}
            isMotion={false}
            isSelected={isSelected}
            rowMotion={undefined}
            onRowClick={onRowClick}
            onRowHover={onRowHover}
            rowClassName={rowClassName}
            hasSelection={hasSelection}
            onSelectOne={onSelectOne}
            selectRowAriaLabel={selectRowAriaLabel}
            columns={columns}
            stickyColumnId={stickyColumnId}
            renderRowActions={renderRowActions}
            actionsCellClassName={actionsCellClassName}
          />
        );
      })}
      {virtualItems.length > 0 && (
        <TableRow
          style={{
            height: `${totalSize - virtualItems[virtualItems.length - 1].end}px`,
          }}
          className="border-0 hover:bg-transparent"
        >
          <TableCell colSpan={totalColSpan} className="p-0 border-0" />
        </TableRow>
      )}
    </>
  );
}
