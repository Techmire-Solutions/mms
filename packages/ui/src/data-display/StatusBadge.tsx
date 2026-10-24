import * as React from "react";
import { Badge } from "../button/Badge";
import { cn } from "../utils";

export interface StatusBadgeConfigItem {
  label: string;
  cls: string;
  dot?: string;
}

export interface StatusBadgeProps {
  status: string;
  config?: Record<string, StatusBadgeConfigItem>;
  size?: "sm" | "md";
  className?: string;
  /** When set, renders an interactive button badge and stops click propagation. */
  onClick?: () => void;
}

const DEFAULT_CLS: Record<string, string> = {
  active: "bg-success/10 text-success border-success/20",
  inactive: "bg-muted text-muted-foreground border-border",
  suspended: "bg-warning/10 text-warning border-warning/20",
  graduated: "bg-info/10 text-info border-info/20",
  transferred: "bg-info/15 text-info border-info/30",
  confirmed: "bg-success/10 text-success border-success/20",
  pending: "bg-warning/10 text-warning border-warning/20",
  paid: "bg-success/10 text-success border-success/20",
  overdue: "bg-destructive/10 text-destructive border-destructive/20",
  partial: "bg-info/10 text-info border-info/20",
  none: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-muted text-muted-foreground border-border",
  completed: "bg-success/10 text-success border-success/20",
  upcoming: "bg-info/10 text-info border-info/20",
  ongoing: "bg-warning/10 text-warning border-warning/20",
  success: "bg-success/10 text-success border-success/20",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
  posted: "bg-success/15 text-success border-success/30",
  draft: "bg-muted text-muted-foreground border-border",
  sent: "bg-success/10 text-success border-success/20",
  delivered: "bg-success/15 text-success border-success/30",
  skipped: "bg-muted text-muted-foreground border-border",
};

const DEFAULT_LABELS: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
  suspended: "Suspended",
  graduated: "Graduated",
  transferred: "Transferred",
  confirmed: "Confirmed",
  pending: "Pending",
  paid: "Paid",
  overdue: "Overdue",
  partial: "Partial",
  none: "None",
  cancelled: "Cancelled",
  completed: "Completed",
  upcoming: "Upcoming",
  ongoing: "Ongoing",
  success: "Success",
  failed: "Failed",
  posted: "Posted",
  draft: "Draft",
  sent: "Sent",
  delivered: "Delivered",
  skipped: "Skipped",
};

/**
 * Universal entity status badge.
 * Maps status strings to standardized semantic colors, dot indicators, and accessible labels.
 */
export function StatusBadge({
  status,
  config = {},
  size = "md",
  className,
  onClick,
}: StatusBadgeProps): React.JSX.Element {
  const fallbackLabel = DEFAULT_LABELS[status] ?? status;
  const fallbackCls = DEFAULT_CLS[status] ?? "bg-muted text-muted-foreground border-border";

  const userConfig = config[status];
  const resolvedConfig = {
    label: userConfig?.label ?? fallbackLabel,
    cls: userConfig?.cls ? userConfig.cls : fallbackCls,
    dot: userConfig?.dot,
  };

  const content = (
    <>
      {resolvedConfig.dot && (
        <span
          className={cn("w-1.5 h-1.5 rounded-full shrink-0", resolvedConfig.dot)}
          aria-hidden="true"
        />
      )}
      {resolvedConfig.label}
    </>
  );

  return (
    <Badge
      as={onClick ? "button" : "span"}
      size={size}
      onClick={
        onClick
          ? (event) => {
              event.stopPropagation();
              onClick();
            }
          : undefined
      }
      className={cn("font-bold text-xs", resolvedConfig.cls, className)}
    >
      {content}
    </Badge>
  );
}

StatusBadge.displayName = "StatusBadge";
