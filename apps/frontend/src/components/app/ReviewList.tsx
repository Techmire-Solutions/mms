import React, { type HTMLAttributes, type ReactNode } from "react";
import { FORM_LABEL } from "@/components/ui/formStyles";
import { cn } from "@/lib/utils";

export interface ReviewRowItem {
  label: string;
  value: ReactNode;
  action?: ReactNode;
}

export interface ReviewListProps extends HTMLAttributes<HTMLDListElement> {
  items?: ReviewRowItem[];
  variant?: "divided" | "compact";
  children?: ReactNode;
}

export interface ReviewListRowProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  value: ReactNode;
  action?: ReactNode;
  variant?: "divided" | "compact";
  isLast?: boolean;
}

export function ReviewListRow({
  label,
  value,
  action,
  variant = "divided",
  isLast = false,
  className,
  ...props
}: ReviewListRowProps): React.JSX.Element {
  if (variant === "compact") {
    return (
      <div className={cn("text-xs break-words", className)} {...props}>
        <dt className="inline text-muted-foreground">{label}:</dt>{" "}
        <dd className="inline font-bold text-foreground">{value}</dd>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-start gap-4 px-4 py-3",
        !isLast && "border-b border-border",
        className,
      )}
      {...props}
    >
      <dt
        className={cn(
          FORM_LABEL,
          "mb-0 w-32 shrink-0 pt-0.5 text-xs text-muted-foreground font-semibold",
        )}
      >
        {label}
      </dt>
      <dd className="min-w-0 flex-1 break-words text-sm font-semibold text-foreground m-0">
        {value}
      </dd>
      {action ? <div className="shrink-0 -my-1">{action}</div> : null}
    </div>
  );
}

/**
 * Single source of truth for key-value review and summary definition lists (`<dl>`).
 * Used across transaction wizards, modal summaries, and detail panels.
 */
export function ReviewList({
  items,
  variant = "divided",
  children,
  className,
  ...props
}: ReviewListProps): React.JSX.Element {
  return (
    <dl
      className={cn(
        variant === "divided"
          ? "rounded-2xl border border-border overflow-hidden m-0 bg-card"
          : "rounded-xl border border-border/60 bg-muted/30 p-3 space-y-1 text-xs break-words m-0",
        className,
      )}
      {...props}
    >
      {items
        ? items.map((item, index) => (
            <ReviewListRow
              key={item.label}
              label={item.label}
              value={item.value}
              action={item.action}
              variant={variant}
              isLast={index === items.length - 1}
            />
          ))
        : children}
    </dl>
  );
}
