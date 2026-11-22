import React, { type JSX } from "react";
import { AnimatePresence } from "framer-motion";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Table, TableBody } from "@/components/ui/table";
import { ModuleWorkTableHeader } from "@/components/app/ModuleWorkTableHeader";
import { ModuleTableFooterCount } from "@/components/app/ModuleTableFooterCount";
import { WorkBatchTableRow } from "./WorkBatchTableRow";
import { WorkBatchTableVirtualizedRows } from "./WorkBatchTableVirtualizedRows";
import { WorkBatchTableFooter } from "./WorkBatchTableFooter";
import {
  computeWorkTableMinWidth,
  resolveWorkColumnMinWidth,
  resolveWorkColumnWidth,
} from "./workBatchTableWidths";
import type { WorkBatchTableColumn, WorkBatchTableProps } from "./workBatchTableTypes";
import { useListRowMotion } from "@/hooks/useListRowMotion";
import { WORK_TABLE_DENSITY_PADDING } from "@/hooks/useWorkTableDensity";
import { useWorkBatchTableInternalState } from "./useWorkBatchTableInternalState";
import { useWorkBatchTableAnnouncements } from "./useWorkBatchTableAnnouncements";
import { useWorkBatchTableStickyOffsets } from "./useWorkBatchTableStickyOffsets";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { WORK_SURFACE } from "@/components/ui/formStyles";

export type { WorkBatchTableColumn, WorkBatchTableProps };

/**
 * Universal WorkBatchTable primitive.
 * Standardizes operational tables with selectable rows, sticky headers,
 * sortable columns, resizable headers, and row actions.
 */
export function WorkBatchTable<TData extends { id: string | number }>({
  data,
  columns,
  selection,
  sort,
  columnResize,
  renderRowActions,
  actionsLabel,
  actionsHeaderClassName,
  actionsCellClassName,
  actionsWidth,
  stickyColumnId,
  stickyColumnIds,
  stickyEndColumnIds,
  rowHeaderColumnId,
  density = "standard",
  onReorderColumn,
  isColumnDraggable,
  optimisticDeletedIds,
  footerCount,
  caption,
  bordered = true,
  tableFooter,
  footerRow,
  emptyState,
  isLoading,
  onRowClick,
  onRowHover,
  virtualize,
  estimateRowSize,
  maxHeightClassName = "max-h-[calc(100vh-19rem)] min-h-75 max-h-150",
  rowClassName,
  className,
  tableBodyClassName,
  containerClassName,
}: WorkBatchTableProps<TData>): JSX.Element {
  const { t } = useTranslation();
  const resolvedActionsLabel = actionsLabel ?? t("common.actions");
  const selectAllAriaLabel = selection?.selectAllAriaLabel ?? t("common.selectAll");

  const { announcement, announceSort, announceResize, announceReorder } =
    useWorkBatchTableAnnouncements(columns);

  const { sortedData, sortConfig, columnResizeConfig } = useWorkBatchTableInternalState({
    data,
    columns,
    sort,
    columnResize,
  });

  const rowMotion = useListRowMotion({ layout: "position", fade: true, duration: 0.1 });
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selectedSet = React.useMemo(() => {
    if (!selection) return new Set<string | number>();
    return selection.selectedIds instanceof Set
      ? selection.selectedIds
      : new Set(selection.selectedIds);
  }, [selection]);

  const activeRows = React.useMemo(() => {
    if (!optimisticDeletedIds || optimisticDeletedIds.size === 0) return sortedData;
    return sortedData.filter((row) => !optimisticDeletedIds.has(row.id));
  }, [sortedData, optimisticDeletedIds]);

  const getStoredColumnWidth = columnResizeConfig.getColumnWidth;
  const resolvedWidths = React.useMemo(
    () =>
      new Map(
        columns.map((col) => [col.id, resolveWorkColumnWidth(col, getStoredColumnWidth(col.id))]),
      ),
    [columns, getStoredColumnWidth],
  );
  const tableMinWidth = computeWorkTableMinWidth([...resolvedWidths.values()], {
    selection: Boolean(selection),
    actions: Boolean(renderRowActions),
    actionsWidth,
  });

  const isVirtualized = Boolean(virtualize ?? activeRows.length > 30);

  const rowVirtualizer = useVirtualizer({
    count: activeRows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => estimateRowSize ?? 52,
    overscan: 10,
    enabled: isVirtualized,
  });

  const virtualItems = isVirtualized ? rowVirtualizer.getVirtualItems() : [];
  const totalColSpan = columns.length + (selection ? 1 : 0) + (renderRowActions ? 1 : 0);
  const resolvedRowHeaderColumnId = rowHeaderColumnId ?? stickyColumnId;
  const { cell: cellPaddingClass, header: headerPaddingClass } =
    WORK_TABLE_DENSITY_PADDING[density];

  // Pinned columns: ordered left/right lists with cumulative sticky offsets
  // (referentially stable so they don't defeat WorkBatchTableRow's React.memo).
  const { leftPinnedIds, rightPinnedIds, stickyLeftOffsets, stickyRightOffsets } =
    useWorkBatchTableStickyOffsets({
      stickyColumnId,
      stickyColumnIds,
      stickyEndColumnIds,
      resolvedWidths,
      hasSelection: Boolean(selection),
      hasRowActions: Boolean(renderRowActions),
      actionsWidth,
    });

  if (!isLoading && activeRows.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  const headerColumns = columns.map((col) => ({
    id: col.id,
    label: col.label,
    sortField: col.sortField,
    sortable: col.sortable,
    width: resolvedWidths.get(col.id),
    minWidth: resolveWorkColumnMinWidth(col),
    headerClassName: col.headerClassName,
    noWrap: col.noWrap,
    truncate: col.truncate,
    align: col.align,
    variant: col.variant,
  }));

  return (
    <div className={cn("space-y-2 pb-6", containerClassName)}>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
      <div
        ref={containerRef}
        role="region"
        aria-label={caption ?? t("table.scrollable")}
        tabIndex={0}
        className={cn(
          "overflow-x-auto",
          // Keep keyboard-focused rows clear of the sticky header (WCAG 2.2 2.4.11).
          "scroll-pt-12",
          Boolean(maxHeightClassName) && cn(maxHeightClassName, "overflow-y-auto"),
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40",
          bordered && WORK_SURFACE,
        )}
      >
        <Table
          stickyHeader
          scrollRegionLabel={false}
          containerClassName="overflow-visible max-w-full"
          className={cn("table-fixed w-full", className)}
          style={{ minWidth: tableMinWidth }}
        >
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <ModuleWorkTableHeader
            columns={headerColumns}
            sortField={sortConfig.field}
            sortDir={sortConfig.dir}
            onSort={sortConfig.onSort}
            getColumnWidth={(key) => resolvedWidths.get(key)}
            setColumnWidth={(key, width) => columnResizeConfig.onColumnResize(key, width)}
            selection={
              selection
                ? {
                    allSelected: selection.allSelected,
                    someSelected: selection.someSelected,
                    onSelectAll: selection.onSelectAll,
                    ariaLabel: selectAllAriaLabel,
                  }
                : undefined
            }
            actionsLabel={renderRowActions ? resolvedActionsLabel : undefined}
            actionsClassName={actionsHeaderClassName}
            stickyColumnIds={leftPinnedIds}
            stickyEndColumnIds={rightPinnedIds}
            stickyLeftOffsets={stickyLeftOffsets}
            stickyRightOffsets={stickyRightOffsets}
            onReorderColumn={onReorderColumn}
            isColumnDraggable={isColumnDraggable}
            headerPaddingClass={headerPaddingClass}
            onSortAnnounce={announceSort}
            onResizeAnnounce={announceResize}
            onReorderAnnounce={announceReorder}
          />

          <TableBody className={cn("divide-y divide-border/50", tableBodyClassName)}>
            {isVirtualized ? (
              <WorkBatchTableVirtualizedRows
                virtualItems={virtualItems}
                activeRows={activeRows}
                selectedSet={selectedSet}
                totalColSpan={totalColSpan}
                totalSize={rowVirtualizer.getTotalSize()}
                columns={columns}
                stickyLeftOffsets={stickyLeftOffsets}
                stickyRightOffsets={stickyRightOffsets}
                rowHeaderColumnId={resolvedRowHeaderColumnId}
                hasSelection={Boolean(selection)}
                onSelectOne={selection?.onSelectOne}
                onSelectRange={selection?.onSelectRange}
                selectRowAriaLabel={selection?.selectRowAriaLabel}
                renderRowActions={renderRowActions}
                actionsCellClassName={actionsCellClassName}
                cellPaddingClass={cellPaddingClass}
                onRowClick={onRowClick}
                onRowHover={onRowHover}
                rowClassName={rowClassName}
              />
            ) : (
              <AnimatePresence initial={false}>
                {activeRows.map((row, rowIndex) => {
                  const isSelected = selectedSet.has(row.id) || selectedSet.has(String(row.id));
                  return (
                    <WorkBatchTableRow
                      key={String(row.id)}
                      row={row}
                      rowIndex={rowIndex}
                      isMotion={true}
                      isSelected={isSelected}
                      rowMotion={rowMotion}
                      onRowClick={onRowClick}
                      onRowHover={onRowHover}
                      rowClassName={rowClassName}
                      hasSelection={Boolean(selection)}
                      onSelectOne={selection?.onSelectOne}
                      onSelectRange={selection?.onSelectRange}
                      selectRowAriaLabel={selection?.selectRowAriaLabel}
                      columns={columns}
                      stickyLeftOffsets={stickyLeftOffsets}
                      stickyRightOffsets={stickyRightOffsets}
                      rowHeaderColumnId={resolvedRowHeaderColumnId}
                      renderRowActions={renderRowActions}
                      actionsCellClassName={actionsCellClassName}
                      cellPaddingClass={cellPaddingClass}
                    />
                  );
                })}
              </AnimatePresence>
            )}
          </TableBody>
          {footerRow && !tableFooter ? <WorkBatchTableFooter footerRow={footerRow} /> : null}
        </Table>
        {tableFooter}
      </div>

      {footerCount && (
        <ModuleTableFooterCount
          selectedCount={selectedSet.size}
          selectedCountLabel={footerCount.selectedCountLabel ?? ""}
          pageCountLabel={footerCount.pageCountLabel ?? ""}
        />
      )}
    </div>
  );
}
