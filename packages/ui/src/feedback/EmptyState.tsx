import React from "react";
import { Inbox } from "lucide-react";
import { FeedbackStateLayout } from "./FeedbackStateLayout";
import { cn } from "../utils";

export interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }> | null;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
  variant?: "default" | "dashed";
  className?: string;
  role?: "status" | "presentation" | "alert";
}

/**
 * Universal EmptyState component — shown when a collection or filtered list has no data.
 */
export function EmptyState({
  icon,
  title,
  description = "",
  action = null,
  compact = false,
  variant = "default",
  className,
  role = "status",
}: EmptyStateProps): React.JSX.Element {
  const isDashed = variant === "dashed";
  const Icon = icon === undefined ? (isDashed ? null : Inbox) : icon;

  return (
    <FeedbackStateLayout
      role={role}
      title={title}
      description={description}
      action={action}
      compact={compact}
      dashed={isDashed}
      className={className}
      icon={
        Icon &&
        (isDashed ? (
          <Icon
            className={cn("text-muted-foreground mx-auto mb-2", compact ? "w-6 h-6" : "w-8 h-8")}
            aria-hidden
          />
        ) : (
          <div
            className={cn(
              "rounded-2xl bg-muted flex items-center justify-center mb-4",
              compact ? "w-10 h-10" : "w-14 h-14",
            )}
          >
            <Icon
              className={cn("text-muted-foreground", compact ? "w-5 h-5" : "w-7 h-7")}
              aria-hidden="true"
            />
          </div>
        ))
      }
    />
  );
}
