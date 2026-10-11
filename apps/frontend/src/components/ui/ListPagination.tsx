import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AppTranslationKey } from '@mms/shared';

export interface ListPaginationProps {
  page: number;
  total: number;
  limit: number;
  hasMore?: boolean;
  onPageChange: (page: number) => void;
  i18nNamespace?: string; // e.g. 'students', 'contacts', 'faculty', 'enrollments', 'attendance'
  variant?: 'range' | 'summary' | 'compact'; // 'range' | 'summary' | 'compact'
  className?: string;
}

export function ListPagination({
  page = 1,
  total = 0,
  limit = 50,
  hasMore = false,
  onPageChange,
  i18nNamespace = 'common',
  variant = 'range',
  className,
}: ListPaginationProps): React.JSX.Element | null {
  const { t } = useTranslation();
  
  const parsedPage = Number(page);
  const safePage = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : Math.floor(parsedPage);

  const parsedTotal = Number(total);
  const safeTotal = Number.isNaN(parsedTotal) || parsedTotal < 0 ? 0 : Math.floor(parsedTotal);

  const parsedLimit = Number(limit);
  const safeLimit = Number.isNaN(parsedLimit) || parsedLimit <= 0 ? 50 : Math.floor(parsedLimit);

  const totalPages = Math.max(1, Math.ceil(safeTotal / safeLimit));
  
  const from = safeTotal === 0 ? 0 : (safePage - 1) * safeLimit + 1;
  const to = Math.min(safePage * safeLimit, safeTotal);

  if (variant === 'compact') {
    if (totalPages <= 1) return null;
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        <Button
          variant="outline"
          size="icon"
          className="rounded-md border-border/60 hover:bg-background/80 transition-colors shadow-none cursor-pointer"
          disabled={safePage === 1}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          aria-label={t("pagination.previousAria")}
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        </Button>
        <span className="text-xs font-bold text-muted-foreground select-none">
          {safePage} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="rounded-md border-border/60 hover:bg-background/80 transition-colors shadow-none cursor-pointer"
          disabled={safePage === totalPages}
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          aria-label={t("pagination.nextAria")}
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </Button>
      </div>
    );
  }

  if (variant === 'summary') {
    const summaryKey = `${i18nNamespace}.pagination.summary` as AppTranslationKey;
    const labelKey = `${i18nNamespace}.pagination.label` as AppTranslationKey;
    const prevKey = `${i18nNamespace}.pagination.previous` as AppTranslationKey;
    const nextKey = `${i18nNamespace}.pagination.next` as AppTranslationKey;

    const navLabel = i18nNamespace === 'enrollments' ? t(labelKey) : undefined;

    return (
      <div 
        className={cn("flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground py-2", className)}
        role="navigation"
        aria-label={navLabel}
      >
        <span>{t(summaryKey, { count: safeTotal, page: safePage, totalPages })}</span>
        {safeTotal > safeLimit && (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onPageChange(Math.max(1, safePage - 1))}
              disabled={safePage === 1}
              aria-label={t(prevKey)}
              className="rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5 rtl:rotate-180" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
              disabled={safePage === totalPages}
              aria-label={t(nextKey)}
              className="rounded-lg border border-border hover:bg-muted disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Variant: range (detailed)
  const rangeKey = `${i18nNamespace}.pagination.range` as AppTranslationKey;
  const prevKey = `${i18nNamespace}.pagination.previous` as AppTranslationKey;
  const nextKey = `${i18nNamespace}.pagination.next` as AppTranslationKey;
  const pageOfKey = `${i18nNamespace}.pagination.pageOf` as AppTranslationKey;

  const actualHasMore = hasMore || safePage < totalPages;

  return (
    <div 
      className={cn("flex flex-wrap items-center justify-between gap-3 px-1 py-2 text-sm", className)}
      role="navigation"
      aria-label={t(`${i18nNamespace}.pagination.label` as AppTranslationKey) ?? "Pagination"}
    >
      <p className="text-muted-foreground text-xs">
        {t(rangeKey, { from, to, total: safeTotal })}
      </p>
      {safeTotal > safeLimit && (
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            variant="outline"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            className="inline-flex min-h-11 items-center gap-1 px-2.5 py-2 rounded-lg border border-border disabled:opacity-40 hover:bg-muted/60 text-foreground shadow-none text-xs font-normal"
            aria-label={t(prevKey)}
          >
            <ChevronLeft className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
            {t(prevKey)}
          </Button>
          <span className="text-xs text-muted-foreground px-2 tabular-nums">
            {t(pageOfKey, { page: safePage, totalPages })}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={!actualHasMore}
            onClick={() => onPageChange(safePage + 1)}
            className="inline-flex min-h-11 items-center gap-1 px-2.5 py-2 rounded-lg border border-border disabled:opacity-40 hover:bg-muted/60 text-foreground shadow-none text-xs font-normal"
            aria-label={t(nextKey)}
          >
            {t(nextKey)}
            <ChevronRight className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  );
}
