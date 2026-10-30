import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../button/Button";
import { cn } from "../utils";

export interface ListPaginationLabels {
  previous?: string;
  next?: string;
  pageOf?: (page: number, totalPages: number) => string;
  range?: (from: number, to: number, total: number) => string;
  summary?: (count: number, page: number, totalPages: number) => string;
  label?: string;
}

export interface ListPaginationProps {
  page: number;
  total: number;
  limit: number;
  hasMore?: boolean;
  onPageChange: (page: number) => void;
  variant?: "range" | "summary" | "compact";
  className?: string;
  labels?: ListPaginationLabels;
  /** Locale-aware formatter for compact page counters (defaults to String). */
  formatPageNumber?: (value: number) => string;
}

const DEFAULT_LABELS: Required<ListPaginationLabels> = {
  previous: "Previous",
  next: "Next",
  pageOf: (page, totalPages) => `Page ${page} of ${totalPages}`,
  range: (from, to, total) => `Showing ${from} to ${to} of ${total}`,
  summary: (count, page, totalPages) => `${count} items · Page ${page} of ${totalPages}`,
  label: "Pagination",
};

/**
 * Universal table and list pagination component.
 * Supports range (detailed), summary, and compact modes with accessible ARIA pagination.
 */
export function ListPagination({
  page = 1,
  total = 0,
  limit = 50,
  hasMore = false,
  onPageChange,
  variant = "range",
  className,
  labels,
  formatPageNumber = String,
}: ListPaginationProps): React.JSX.Element | null {
  const l = { ...DEFAULT_LABELS, ...labels };

  const parsedPage = Number(page);
  const safePage = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : Math.floor(parsedPage);

  const parsedTotal = Number(total);
  const safeTotal = Number.isNaN(parsedTotal) || parsedTotal < 0 ? 0 : Math.floor(parsedTotal);

  const parsedLimit = Number(limit);
  const safeLimit = Number.isNaN(parsedLimit) || parsedLimit <= 0 ? 50 : Math.floor(parsedLimit);

  const totalPages = Math.max(1, Math.ceil(safeTotal / safeLimit));

  const from = safeTotal === 0 ? 0 : (safePage - 1) * safeLimit + 1;
  const to = Math.min(safePage * safeLimit, safeTotal);

  if (variant === "compact") {
    if (totalPages <= 1) return null;
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="rounded-md border-border/60 hover:bg-background/80 transition-colors shadow-none cursor-pointer"
          disabled={safePage === 1}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          aria-label={l.previous}
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        </Button>
        <bdi dir="ltr" className="text-xs font-bold text-muted-foreground select-none tabular-nums">
          {formatPageNumber(safePage)} / {formatPageNumber(totalPages)}
        </bdi>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="rounded-md border-border/60 hover:bg-background/80 transition-colors shadow-none cursor-pointer"
          disabled={safePage === totalPages}
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          aria-label={l.next}
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  if (variant === "summary") {
    return (
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground py-2",
          className,
        )}
        role="navigation"
        aria-label={l.label}
      >
        <span>{l.summary(safeTotal, safePage, totalPages)}</span>
        {safeTotal > safeLimit && (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onPageChange(Math.max(1, safePage - 1))}
              disabled={safePage === 1}
              aria-label={l.previous}
              className="rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5 rtl:rotate-180" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
              disabled={safePage === totalPages}
              aria-label={l.next}
              className="rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Variant: range (detailed)
  const actualHasMore = hasMore || safePage < totalPages;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 px-1 py-2 text-sm",
        className,
      )}
      role="navigation"
      aria-label={l.label}
    >
      <p className="text-muted-foreground text-xs">{l.range(from, to, safeTotal)}</p>
      {safeTotal > safeLimit && (
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            variant="outline"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            className="inline-flex min-h-11 items-center gap-1 px-2.5 py-2 rounded-lg border border-border disabled:opacity-40 hover:bg-muted/60 text-foreground shadow-none text-xs font-normal cursor-pointer"
            aria-label={l.previous}
          >
            <ChevronLeft className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
            {l.previous}
          </Button>
          <span className="text-xs text-muted-foreground px-2 tabular-nums">
            {l.pageOf(safePage, totalPages)}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={!actualHasMore}
            onClick={() => onPageChange(safePage + 1)}
            className="inline-flex min-h-11 items-center gap-1 px-2.5 py-2 rounded-lg border border-border disabled:opacity-40 hover:bg-muted/60 text-foreground shadow-none text-xs font-normal cursor-pointer"
            aria-label={l.next}
          >
            {l.next}
            <ChevronRight className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  );
}

ListPagination.displayName = "ListPagination";
