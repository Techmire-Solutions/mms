import React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  items: readonly BreadcrumbItem[];
  ariaLabel: string;
  className?: string;
  /** Optional custom link renderer to allow router decoupling. Falls back to standard anchor tag. */
  renderLink?: (item: BreadcrumbItem, children: React.ReactNode) => React.ReactNode;
}

/**
 * Shared breadcrumb trail — logical CSS, RTL-safe chevron, router-agnostic.
 */
export function Breadcrumb({
  items,
  ariaLabel,
  className,
  renderLink,
}: BreadcrumbProps): React.JSX.Element {
  return (
    <nav aria-label={ariaLabel} className={cn("flex items-center gap-2 text-xs", className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const linkContent = item.label;

        return (
          <React.Fragment key={`${item.label}-${index}`}>
            {index > 0 ? (
              <ChevronRight
                className="h-3.5 w-3.5 text-muted-foreground/50 rtl:rotate-180 shrink-0"
                aria-hidden
              />
            ) : null}
            {item.href && !isLast ? (
              renderLink ? (
                renderLink(item, linkContent)
              ) : (
                <a
                  href={item.href}
                  className="font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  {linkContent}
                </a>
              )
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

Breadcrumb.displayName = "Breadcrumb";
