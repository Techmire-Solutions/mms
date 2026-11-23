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
import { cn } from "@/lib/utils";

export interface ModuleWorkTableHeaderProps<
  TCol extends {
    id: string;
    label: string;
    sortField?: string;
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

  // Optional name property to make it sticky beside the checkbox.
  // Defaults to "name" as the identifier for the sticky column if any.
  stickyColumnId?: string;

  // Optional column drag-and-drop reorder callback
  onReorderColumns?: (sourceId: string, targetId: string) => void;
}

export function ModuleWorkTableHeader<
  TCol extends {
    id: string;
    label: string;
    sortField?: string;
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
  stickyColumnId = "name",
  onReorderColumns,
}: ModuleWorkTableHeaderProps<TCol>): JSX.Element {
  const [draggedColumnId, setDraggedColumnId] = React.useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = React.useState<string | null>(null);

  return (
    <TableHeader>
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
              "w-12 min-w-12 px-4 py-3 sticky start-0 z-sticky border-e border-border/30 h-auto cursor-pointer",
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
          const sortKey = col.sortField || col.id;

          // If there is a selection column, the sticky column needs to start at offset 12 (48px).
          // Otherwise, it starts at 0.
          let stickyClass = "";
          if (col.id === stickyColumnId) {
            if (selection) {
              stickyClass = cn(
                "sticky start-12 z-sticky border-e border-border/30",
                WORK_STICKY_HEAD,
              );
            } else {
              stickyClass = cn(
                "sticky start-0 z-sticky border-e border-border/30",
                WORK_STICKY_HEAD,
              );
            }
          }

          const width = getColumnWidth(col.id) ?? col.width;
          const isSticky = col.id === stickyColumnId;
          const canDrag = Boolean(onReorderColumns && !isSticky);
          const isDragging = draggedColumnId === col.id;
          const isDragOver = dragOverColumnId === col.id && draggedColumnId !== col.id;

          return (
            <ModuleTableHeaderCell
              key={col.id}
              columnKey={col.id}
              sortKey={sortKey}
              activeSortField={sortField}
              sortDir={sortDir}
              onSort={onSort}
              width={width}
              minWidth={col.minWidth}
              onResize={setColumnWidth}
              noWrap={col.noWrap}
              truncate={col.truncate}
              align={col.align}
              variant={col.variant}
              draggable={canDrag}
              onDragStart={
                canDrag
                  ? (e: React.DragEvent) => {
                      e.dataTransfer.setData("text/plain", col.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDraggedColumnId(col.id);
                    }
                  : undefined
              }
              onDragOver={
                canDrag
                  ? (e: React.DragEvent) => {
                      if (draggedColumnId && draggedColumnId !== col.id) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        if (dragOverColumnId !== col.id) {
                          setDragOverColumnId(col.id);
                        }
                      }
                    }
                  : undefined
              }
              onDragLeave={
                canDrag
                  ? () => {
                      if (dragOverColumnId === col.id) {
                        setDragOverColumnId(null);
                      }
                    }
                  : undefined
              }
              onDrop={
                canDrag
                  ? (e: React.DragEvent) => {
                      e.preventDefault();
                      const sourceId = e.dataTransfer.getData("text/plain") || draggedColumnId;
                      if (sourceId && sourceId !== col.id && onReorderColumns) {
                        onReorderColumns(sourceId, col.id);
                      }
                      setDraggedColumnId(null);
                      setDragOverColumnId(null);
                    }
                  : undefined
              }
              onDragEnd={
                canDrag
                  ? () => {
                      setDraggedColumnId(null);
                      setDragOverColumnId(null);
                    }
                  : undefined
              }
              className={cn(
                "px-4 py-3 text-wrap break-words transition-all",
                stickyClass,
                canDrag && "cursor-grab active:cursor-grabbing",
                isDragging && "opacity-40",
                isDragOver && "border-s-2 border-primary bg-primary/10",
                col.headerClassName,
              )}
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
              "px-4 py-3 text-end h-auto",
              actionsClassName,
            )}
          >
            <span>{actionsLabel}</span>
          </TableHead>
        )}
      </TableRow>
    </TableHeader>
  );
}
