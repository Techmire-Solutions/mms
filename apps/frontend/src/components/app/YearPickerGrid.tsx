import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";

export interface YearPickerGridProps {
  selectedYear?: number;
  yearPageStart: number;
  minYear: number;
  maxYear: number;
  onSelectYear: (year: number) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onClear: (event?: React.MouseEvent) => void;
  onSelectThisYear: () => void;
  isThisYearAllowed: boolean;
  hasValue: boolean;
  disabled?: boolean;
  className?: string;
}

export function YearPickerGrid({
  selectedYear,
  yearPageStart,
  minYear,
  maxYear,
  onSelectYear,
  onPreviousPage,
  onNextPage,
  onClear,
  onSelectThisYear,
  isThisYearAllowed,
  hasValue,
  disabled,
  className,
}: YearPickerGridProps) {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  const pageEndYear = yearPageStart + 11;

  const canGoPrevious = yearPageStart > minYear;
  const canGoNext = pageEndYear < maxYear;

  const years = (() => {
    const list: number[] = [];
    for (let y = yearPageStart; y <= pageEndYear; y++) {
      list.push(y);
    }
    return list;
  })();

  return (
    <div className={cn("w-68 sm:w-72 p-3 select-none", className)}>
      {/* Header with Decade Range and Navigation */}
      <div className="flex items-center justify-between pb-2 border-b border-border/40 mb-2">
        <button
          type="button"
          onClick={onPreviousPage}
          disabled={!canGoPrevious || disabled}
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "relative h-8 w-8 min-h-8 min-w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed after:absolute after:start-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']",
          )}
          aria-label={t("datePicker.previousYears")}
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180 transition-transform" />
        </button>

        <span className="text-xs font-semibold text-foreground tracking-wide">
          {yearPageStart} – {pageEndYear}
        </span>

        <button
          type="button"
          onClick={onNextPage}
          disabled={!canGoNext || disabled}
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "relative h-8 w-8 min-h-8 min-w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed after:absolute after:start-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']",
          )}
          aria-label={t("datePicker.nextYears")}
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180 transition-transform" />
        </button>
      </div>

      {/* 3x4 Year Grid */}
      <div
        className="grid grid-cols-3 gap-2 py-1"
        role="grid"
        aria-label={t("datePicker.openYearAria")}
      >
        {years.map((year) => {
          const isSelected = selectedYear === year;
          const isCurrent = currentYear === year;
          const isYearDisabled = year < minYear || year > maxYear || disabled;

          return (
            <button
              key={year}
              type="button"
              role="gridcell"
              disabled={isYearDisabled}
              onClick={() => onSelectYear(year)}
              aria-selected={isSelected}
              aria-label={t("datePicker.selectYearAria", { year })}
              className={cn(
                "min-h-11 h-11 sm:min-h-9 sm:h-9 w-full rounded-lg text-xs font-medium transition-all duration-100 flex items-center justify-center cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 touch-manipulation",
                // Selected
                isSelected &&
                  "bg-primary text-primary-foreground font-bold shadow-md shadow-primary/30 hover:bg-primary hover:text-primary-foreground",
                // Current year unselected
                isCurrent &&
                  !isSelected &&
                  "text-primary font-bold ring-1.5 ring-primary/40 bg-primary/10 hover:bg-primary/15 active:scale-95",
                // Normal unselected
                !isSelected &&
                  !isCurrent &&
                  !isYearDisabled &&
                  "text-foreground font-semibold hover:bg-muted/80 active:scale-95",
                // Disabled
                isYearDisabled &&
                  "text-muted-foreground/45 cursor-not-allowed pointer-events-none opacity-40 rounded-lg",
              )}
            >
              {year}
            </button>
          );
        })}
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between border-t border-border/60 px-1 pt-2.5 mt-2 bg-muted/10 -mx-3 -mb-3 p-3 rounded-b-2xl">
        <button
          type="button"
          onClick={onClear}
          disabled={!hasValue || disabled}
          className="text-xs font-medium text-muted-foreground hover:text-destructive disabled:opacity-30 disabled:hover:text-muted-foreground transition-colors cursor-pointer disabled:cursor-not-allowed px-2 py-1 rounded-md hover:bg-destructive/10"
        >
          {t("datePicker.clear")}
        </button>
        <button
          type="button"
          onClick={onSelectThisYear}
          disabled={!isThisYearAllowed || disabled}
          className="text-xs font-semibold text-primary hover:text-primary/80 disabled:opacity-30 disabled:hover:text-primary transition-colors cursor-pointer disabled:cursor-not-allowed px-2.5 py-1 rounded-md hover:bg-primary/10"
        >
          {t("datePicker.thisYear")}
        </button>
      </div>
    </div>
  );
}
