import React, { type JSX } from "react";
import { motion } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ListRowMotionProps } from "@/hooks/useListRowMotion";
import {
  PRIORITY_BADGES,
  type WorkQueuePriority,
  type WorkQueueItemStatus,
} from "./workQueueTypes";

export interface WorkQueueItemProps<TData extends { id: string | number }> {
  item: TData;
  idStr: string;
  isSelected: boolean;
  rowMotion?: ListRowMotionProps;
  priority?: WorkQueuePriority;
  status?: WorkQueueItemStatus;
  itemTitle?: React.ReactNode;
  itemDesc?: React.ReactNode;
  renderItemContent?: (item: TData, isSelected: boolean) => React.ReactNode;
  renderItemActions?: (item: TData) => React.ReactNode;
  hasSelection: boolean;
  onSelectOne?: (id: string) => void;
  selectAriaLabel: string;
  onItemClick?: (item: TData) => void;
}

export function WorkQueueItem<TData extends { id: string | number }>({
  item,
  idStr,
  isSelected,
  rowMotion,
  priority,
  status,
  itemTitle,
  itemDesc,
  renderItemContent,
  renderItemActions,
  hasSelection,
  onSelectOne,
  selectAriaLabel,
  onItemClick,
}: WorkQueueItemProps<TData>): JSX.Element {
  return (
    <motion.li
      key={idStr}
      {...rowMotion}
      onClick={() => onItemClick?.(item)}
      className={cn(
        "group relative flex items-start gap-3 rounded-lg border border-border/60 bg-card p-3.5 transition-colors hover:bg-muted/40",
        isSelected && "border-primary/50 bg-accent/15",
        onItemClick && "cursor-pointer",
      )}
    >
      {/* Checkbox */}
      {hasSelection && onSelectOne && (
        <div className="flex shrink-0 items-center pt-0.5" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onSelectOne(idStr)}
            aria-label={selectAriaLabel}
            className="size-4"
          />
        </div>
      )}

      {/* Content Container */}
      <div className="min-w-0 flex-1 space-y-1">
        {renderItemContent ? (
          renderItemContent(item, isSelected)
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {itemTitle && (
                <span className="text-sm font-medium text-foreground">{itemTitle}</span>
              )}
              {priority && (
                <Badge size="sm" tone={PRIORITY_BADGES[priority].tone} className="text-3xs">
                  {PRIORITY_BADGES[priority].label}
                </Badge>
              )}
              {status && (
                <Badge size="sm" tone={status.tone ?? "secondary"} className="text-3xs">
                  {status.label}
                </Badge>
              )}
            </div>
            {itemDesc && <div className="text-xs text-muted-foreground">{itemDesc}</div>}
          </>
        )}
      </div>

      {/* Trailing Actions */}
      {renderItemActions && (
        <div
          className="flex shrink-0 items-center gap-1.5 ms-2 pt-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          {renderItemActions(item)}
        </div>
      )}
    </motion.li>
  );
}
