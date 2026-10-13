import React from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  items: readonly BreadcrumbItem[];
  ariaLabel: string;
  className?: string;
}

/**
 * Shared breadcrumb trail — logical CSS, RTL-safe chevron.
 */
export function Breadcrumb({ items, ariaLabel, className }: BreadcrumbProps): React.JSX.Element {
  return (
    <nav aria-label={ariaLabel} className={cn("flex items-center gap-2 text-xs", className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={`${item.label}-${index}`}>
            {index > 0 ? (
              <ChevronRight
                className="h-3.5 w-3.5 text-muted-foreground/50 rtl:rotate-180 shrink-0"
                aria-hidden
              />
            ) : null}
            {item.href && !isLast ? (
              <Link
                to={item.href}
                className="font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={cn(
                  isLast ? "font-bold text-foreground" : "font-medium text-muted-foreground",
                )}
              >
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
