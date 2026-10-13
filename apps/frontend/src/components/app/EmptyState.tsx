import React from "react";
import { FeedbackStateLayout } from "./FeedbackStateLayout";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
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
 * EmptyState — shown when a list has no data.
 *
 * @param {EmptyStateProps} props - The component props.
 * @returns {React.ReactElement} The rendered EmptyState component.
 */
export const EmptyState = function EmptyState({
  icon,
  title,
  description = "",
  action = null,
  compact = false,
  variant = "default",
  className,
  role = "status",
}: EmptyStateProps): React.ReactElement {
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
};
