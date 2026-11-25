import type React from "react";
import type { BadgeTone } from "@mms/ui";

export type WorkQueuePriority = "urgent" | "high" | "normal" | "low";

export const PRIORITY_BADGES: Record<WorkQueuePriority, { label: string; tone: BadgeTone }> = {
  urgent: { label: "Urgent", tone: "destructive" },
  high: { label: "High", tone: "warning" },
  normal: { label: "Normal", tone: "primary" },
  low: { label: "Low", tone: "muted" },
};

export interface WorkQueueItemStatus {
  label: string;
  tone?: BadgeTone;
}

export interface WorkQueueProps<TData extends { id: string | number }> {
  items: TData[];
  title?: string;
  description?: string;

  /** Resolves the display priority for an item. */
  priorityField?: (item: TData) => WorkQueuePriority | undefined;

  /** Resolves the display status for an item. */
  statusField?: (item: TData) => WorkQueueItemStatus | undefined;

  /** Resolves the primary title / heading for an item. */
  getItemTitle?: (item: TData) => React.ReactNode;

  /** Resolves secondary subtitle / description for an item. */
  getItemDescription?: (item: TData) => React.ReactNode;

  /** Optional custom rendering for item body, replacing the default title + description layout. */
  renderItemContent?: (item: TData, isSelected: boolean) => React.ReactNode;

  /** Trailing row actions / quick buttons for an item. */
  renderItemActions?: (item: TData) => React.ReactNode;

  /** Selection state and callbacks. */
  selection?: {
    selectedIds: Set<string | number> | Array<string | number>;
    onSelectOne: (id: string) => void;
    onSelectAll: () => void;
    allSelected: boolean;
    someSelected: boolean;
    selectAllAriaLabel?: string;
    selectItemAriaLabel?: (item: TData) => string;
  };

  /** Set of item IDs optimistically marked as removed / completed. */
  optimisticDeletedIds?: Set<string | number>;

  /** Custom empty state when there are zero items in the queue. */
  emptyState?: React.ReactNode;
  isLoading?: boolean;

  /** Header actions or filter slot rendered in the queue header. */
  headerActions?: React.ReactNode;

  /** Sticky header styling (default: true). */
  stickyHeader?: boolean;

  /** Footer counts summary. */
  footerCount?: {
    pageCountLabel?: string;
    selectedCountLabel?: string;
  };

  onItemClick?: (item: TData) => void;
  className?: string;
  containerClassName?: string;
  "aria-label"?: string;
}
