import React, { type JSX } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  MODULE_TABLE_HEAD_TYPOGRAPHY_CLASS,
  ModuleTableHeaderCell,
} from "@/components/app/ModuleTableHeaderCell";
import {
  TableHead,
  TableHeader,
  TableRow,
  type TableCellAlign,
  type TableCellVariant,
} from "@/components/ui/table";
import { WORK_STICKY_HEAD } from "@/components/ui/formStyles";
import { WORK_TABLE_ACTIONS_WIDTH_CLASS } from "@/components/common/work/workBatchTableWidths";
import { useColumnHeaderDrag, type DropPosition } from "@/components/app/useColumnHeaderDrag";
import { cn } from "@/lib/utils";

export interface ModuleWorkTableHeaderProps<
  TCol extends {
    id: string;
    label: string;
    sortField?: string;
    /** `false` omits the sort button for this column. */
    sortable?: boolean;
    width?: number;
    minWidth?: number;
    headerClassName?: string;
    noWrap?: boolean;
    truncate?: boolean;
    align?: TableCellAlign;
    variant?: TableCellVariant;
  },
> {
  columns: TCol[];
  sortField?: string;
  sortDir?: "asc" | "desc";
  onSort?: (field: string) => void;
  getColumnWidth: (key: string) => number | undefined;
  setColumnWidth: (key: string, width: number) => void;

  selection?: {
    allSelected: boolean;
    someSelected: boolean;
    onSelectAll: () => void;
    ariaLabel: string;
  };

  actionsLabel?: string;
  actionsClassName?: string;

  /** Ordered left-pinned column ids (the selection column stays pinned at start). */
  stickyColumnIds?: string[];
  /** Ordered right-pinned column ids (the Actions column stays pinned at end). */
  stickyEndColumnIds?: string[];
  /** Cumulative `inset-inline-start` offsets (px) keyed by left-pinned column id. */
  stickyLeftOffsets?: Record<string, number>;
  /** Cumulative `inset-inline-end` offsets (px) keyed by right-pinned column id. */
  stickyRightOffsets?: Record<string, number>;

  /** Callback when a column header is dragged to reorder. */
  onReorderColumn?: (
    sourceColumnId: string,
    targetColumnId: string,
    position: DropPosition,
  ) => void;
  /** Filter to declare whether a column is draggable (e.g. pinned columns). */
  isColumnDraggable?: (columnId: string) => boolean;

  /** Header cell padding override (row density). Defaults to `px-4 py-3`. */
  headerPaddingClass?: string;

  /** SR announcement when a column sort changes (columnId, next dir). */
  onSortAnnounce?: (columnId: string, dir: "asc" | "desc") => void;
  /** SR announcement when a column is resized (columnId, width px). */
  onResizeAnnounce?: (columnId: string, width: number) => void;
  /** SR announcement when a column is reordered (sourceColumnId). */
  onReorderAnnounce?: (sourceColumnId: string) => void;
}

export function ModuleWorkTableHeader<
  TCol extends {
    id: string;
    label: string;
    sortField?: string;
    sortable?: boolean;
    width?: number;
    minWidth?: number;
    headerClassName?: string;
    noWrap?: boolean;
    truncate?: boolean;
    align?: TableCellAlign;
    variant?: TableCellVariant;
  },
>({
  columns,
  sortField,
  sortDir,
  onSort,
  getColumnWidth,
  setColumnWidth,
  selection,
  actionsLabel,
  actionsClassName = WORK_TABLE_ACTIONS_WIDTH_CLASS,
  stickyColumnIds = [],
  stickyEndColumnIds = [],
  stickyLeftOffsets = {},
  stickyRightOffsets = {},
  onReorderColumn,
  isColumnDraggable,
  headerPaddingClass = "px-4 py-3",
  onSortAnnounce,
  onResizeAnnounce,
  onReorderAnnounce,
}: ModuleWorkTableHeaderProps<TCol>): JSX.Element {
  const pinnedColumnIds = React.useMemo(
    () => new Set<string>([...stickyColumnIds, ...stickyEndColumnIds]),
    [stickyColumnIds, stickyEndColumnIds],
  );

  const handleReorder = React.useMemo(() => {
    if (!onReorderColumn) return undefined;
    return (sourceId: string, targetId: string, position: DropPosition) => {
      onReorderColumn(sourceId, targetId, position);
      onReorderAnnounce?.(sourceId);
    };
  }, [onReorderColumn, onReorderAnnounce]);

  const { getThDragProps, renderDropIndicator, renderDragOverlay, suppressClickRef } =
    useColumnHeaderDrag({
      columns,
      pinnedColumnIds,
      onReorder: handleReorder,
      isColumnDraggable,
    });

  return (
    <>
      {renderDragOverlay()}
      {/* `shadow-none` at rest; the scroll-state rule in index.css adds a shadow only
          when the header is stuck, signalling that content scrolls beneath it. */}
      <TableHeader sticky className="shadow-none">
        <TableRow className="border-b border-border bg-muted/30 hover:bg-muted/30">
          {selection && (
            <TableHead
              noWrap
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (!target.closest('button[role="checkbox"]')) {
                  selection.onSelectAll();
                }
              }}
              className={cn(
                "w-12 min-w-12 sticky start-0 z-sticky border-e border-border/30 h-auto cursor-pointer",
                headerPaddingClass,
                WORK_STICKY_HEAD,
              )}
            >
              <Checkbox
                checked={selection.someSelected ? "indeterminate" : selection.allSelected}
                onCheckedChange={() => selection.onSelectAll()}
                aria-label={selection.ariaLabel}
                className="cursor-pointer"
              />
            </TableHead>
          )}

          {columns.map((col) => {
            const sortKey = col.sortable === false ? null : col.sortField || col.id;

            const leftOffset = stickyLeftOffsets[col.id];
            const rightOffset = stickyRightOffsets[col.id];
            const isStickyStart = leftOffset !== undefined;
            const isStickyEnd = rightOffset !== undefined;
            const stickyStyle =
              isStickyStart || isStickyEnd
                ? { insetInlineStart: leftOffset, insetInlineEnd: rightOffset }
                : undefined;
            const stickyClass =
              isStickyStart || isStickyEnd
                ? cn(
                    "sticky z-sticky",
                    isStickyStart ? "border-e border-border/30" : "border-s border-border/30",
                    WORK_STICKY_HEAD,
                  )
                : "";

            const width = getColumnWidth(col.id) ?? col.width;
            const thDragProps = getThDragProps(col.id, col.label);
            const dropIndicator = renderDropIndicator(col.id);

            return (
              <ModuleTableHeaderCell
                key={col.id}
                columnKey={col.id}
                sortKey={sortKey}
                activeSortField={sortField}
                sortDir={sortDir}
                onSort={onSort}
                onSortAnnounce={onSortAnnounce}
                onResizeAnnounce={onResizeAnnounce}
                width={width}
                minWidth={col.minWidth}
                onResize={setColumnWidth}
                noWrap={col.noWrap}
                truncate={col.truncate}
                align={col.align}
                variant={col.variant}
                style={stickyStyle}
                className={cn(
                  headerPaddingClass,
                  "text-wrap break-words",
                  stickyClass,
                  col.headerClassName,
                )}
                thProps={thDragProps}
                dropIndicator={dropIndicator}
                suppressSortClick={suppressClickRef}
              >
                {col.label}
              </ModuleTableHeaderCell>
            );
          })}

          {actionsLabel && (
            <TableHead
              noWrap
              className={cn(
                MODULE_TABLE_HEAD_TYPOGRAPHY_CLASS,
                // Sticky end-edge keeps the Actions column reachable during horizontal
                // scroll; border-s + opaque head separate it from the last data column.
                "text-end h-auto sticky end-0 z-sticky border-s border-border/30",
                headerPaddingClass,
                WORK_STICKY_HEAD,
                actionsClassName,
              )}
            >
              <span>{actionsLabel}</span>
            </TableHead>
          )}
        </TableRow>
      </TableHeader>
    </>
  );
}
