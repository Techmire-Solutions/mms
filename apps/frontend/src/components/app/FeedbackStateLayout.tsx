import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface FeedbackStateLayoutProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
  dashed?: boolean;
  className?: string;
  role?: "status" | "presentation" | "alert";
}

export function FeedbackStateLayout({
  icon,
  title,
  description,
  action,
  compact = false,
  dashed = false,
  className,
  role = "status",
}: FeedbackStateLayoutProps) {
  return (
    <div
      role={role}
      aria-live={role === "status" ? "polite" : role === "alert" ? "assertive" : undefined}
      className={cn(
        "flex min-w-0 flex-col items-center justify-center text-center",
        dashed
          ? cn(
              "rounded-xl border-2 border-dashed border-border",
              compact ? "py-8 px-4" : "py-12 px-4",
            )
          : compact
            ? "py-8 px-4"
            : "py-16 px-6",
        className,
      )}
    >
      {icon}
      <p
        className={cn(
          "max-w-full break-words text-balance text-foreground",
          dashed
            ? "text-sm font-medium m-0"
            : cn("font-semibold", compact ? "text-sm" : "text-base"),
        )}
      >
        {title}
      </p>
      {description && (
        <p
          className={cn(
            "max-w-full break-words text-pretty text-muted-foreground",
            dashed ? "text-xs mt-0.5 m-0" : cn("mt-1.5 max-w-xs", compact ? "text-xs" : "text-sm"),
          )}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-4 max-w-full">{action}</div>}
    </div>
  );
}
