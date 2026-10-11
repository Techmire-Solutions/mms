import * as React from "react";
import { cn } from "@/lib/utils";
import { SearchX, Inbox } from "lucide-react";

export interface TableEmptyProps extends Omit<React.HTMLAttributes<HTMLTableRowElement>, "title"> {
  colSpan: number;
  variant?: "zero-data" | "empty-search";
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}

/**
 * Dedicated semantic table row for empty states inside `<TableBody>`.
 * Supports both "zero-data" (no initial records) and "empty-search" (filtered out).
 */
export function TableEmpty({
  colSpan,
  variant = "zero-data",
  title,
  description,
  action,
  icon: CustomIcon,
  className,
  children,
  ...props
}: TableEmptyProps): React.JSX.Element {
  const IconComponent = CustomIcon ?? (variant === "empty-search" ? SearchX : Inbox);
  const defaultTitle = variant === "empty-search" ? "No results found" : "No records found";
  const defaultDescription =
    variant === "empty-search"
      ? "Try adjusting your search terms or filter criteria."
      : "There is currently no data to display.";

  return (
    <tr role="row" className={cn("hover:bg-transparent", className)} {...props}>
      <td role="cell" colSpan={colSpan} className="py-12 text-center align-middle">
        {children ?? (
          <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground px-4">
            <IconComponent className="h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
            <p className="text-sm font-semibold text-foreground">{title ?? defaultTitle}</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              {description ?? defaultDescription}
            </p>
            {action ? <div className="mt-2">{action}</div> : null}
          </div>
        )}
      </td>
    </tr>
  );
}
