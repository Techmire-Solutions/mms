import React, { type JSX } from "react";
import { AnimatePresence } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";
import { ModuleTableFooterCount } from "@/components/app/ModuleTableFooterCount";
import { useListRowMotion } from "@/hooks/useListRowMotion";
import { cn } from "@/lib/utils";
import {
  type WorkQueueItemStatus,
  type WorkQueuePriority,
  type WorkQueueProps,
} from "./workQueueTypes";
import { WorkQueueItem } from "./WorkQueueItem";

export type { WorkQueueItemStatus, WorkQueuePriority, WorkQueueProps };

/**
 * Universal WorkQueue primitive.
 * Standardizes operational task and workflow queues supporting item selection,
 * priority badges, status transitions, optimistic removal, and sticky queue headers.
 */
export function WorkQueue<TData extends { id: string | number }>({
  items,
  title,
  description,
  priorityField,
  statusField,
  getItemTitle,
  getItemDescription,
  renderItemContent,
  renderItemActions,
  selection,
  optimisticDeletedIds,
  emptyState,
  isLoading,
  headerActions,
  stickyHeader = true,
  footerCount,
  onItemClick,
  className,
  containerClassName,
  "aria-label": ariaLabel = "Operational work queue",
}: WorkQueueProps<TData>): JSX.Element {
  const rowMotion = useListRowMotion({ layout: "position", fade: true, duration: 0.12 });

  const selectedSet = React.useMemo(() => {
    if (!selection) return new Set<string | number>();
    return selection.selectedIds instanceof Set
      ? selection.selectedIds
      : new Set(selection.selectedIds);
  }, [selection]);

  const activeItems = React.useMemo(() => {
    if (!optimisticDeletedIds || optimisticDeletedIds.size === 0) return items;
    return items.filter((item) => !optimisticDeletedIds.has(item.id));
  }, [items, optimisticDeletedIds]);

  if (!isLoading && activeItems.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div role="region" aria-label={ariaLabel} className={cn("space-y-3", containerClassName)}>
      {/* Queue Header */}
      {(title || selection || headerActions) && (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3 px-1",
            stickyHeader && "sticky top-0 z-elevated bg-background/95 backdrop-blur-xs",
          )}
        >
          <div className="flex items-center gap-3">
            {selection && (
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={
                    selection.allSelected ? true : selection.someSelected ? "indeterminate" : false
                  }
                  onCheckedChange={() => selection.onSelectAll()}
                  aria-label={selection.selectAllAriaLabel ?? "Select all queue items"}
                  className="size-4"
                />
              </div>
            )}
            {title && (
              <div>
                <h3 className="text-sm font-semibold text-foreground tracking-tight">{title}</h3>
                {description && <p className="text-xs text-muted-foreground">{description}</p>}
              </div>
            )}
          </div>

          {headerActions && <div className="flex items-center gap-2 ms-auto">{headerActions}</div>}
        </div>
      )}

      {/* Queue Items Feed */}
      <ul className={cn("space-y-2", className)}>
        <AnimatePresence initial={false}>
          {activeItems.map((item, index) => {
            const idStr = String(item.id);
            const isSelected = selectedSet.has(item.id) || selectedSet.has(idStr);
            const priority = priorityField?.(item);
            const status = statusField?.(item);
            const itemTitle = getItemTitle?.(item);
            const itemDesc = getItemDescription?.(item);
            const selectAriaLabel = selection?.selectItemAriaLabel
              ? selection.selectItemAriaLabel(item)
              : `Select queue item ${idStr}`;

            return (
              <WorkQueueItem
                key={idStr}
                item={item}
                idStr={idStr}
                isSelected={isSelected}
                rowMotion={rowMotion(index * 0.02)}
                priority={priority}
                status={status}
                itemTitle={itemTitle}
                itemDesc={itemDesc}
                renderItemContent={renderItemContent}
                renderItemActions={renderItemActions}
                hasSelection={Boolean(selection)}
                onSelectOne={selection?.onSelectOne}
                selectAriaLabel={selectAriaLabel}
                onItemClick={onItemClick}
              />
            );
          })}
        </AnimatePresence>
      </ul>

      {/* Footer summary */}
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
