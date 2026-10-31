import React, { type JSX } from "react";
import { ModuleWorkToolbar } from "@/components/app/ModuleWorkToolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/app/DatePicker";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import type { WorkTaskStatusOption, WorkTaskToolbarProps } from "./workTaskToolbarTypes";

export type { WorkTaskStatusOption, WorkTaskToolbarProps };

/**
 * Universal WorkTaskToolbar primitive.
 * Standardizes operational toolbars with debounced search, status pill toggles,
 * date-range controls, view-mode switching, and column customization.
 */
export function WorkTaskToolbar({
  regionLabel,
  shownCountLabel,
  search,
  onSearchChange,
  searchPlaceholder,
  searchId,
  isSearching,
  statusFilter,
  dateRange,
  filterButton,
  hasActiveFilters,
  onClearFilters,
  clearFiltersLabel,
  filterChips,
  trashToggle,
  viewModeToggle,
  columnCustomizer,
  primaryAction,
  children,
}: WorkTaskToolbarProps): JSX.Element {
  const { t } = useTranslation();
  const hasMiddleContent = Boolean(statusFilter || dateRange || children);

  return (
    <div className="space-y-2.5">
      <ModuleWorkToolbar
        regionLabel={regionLabel}
        shownCountLabel={shownCountLabel}
        search={search}
        onSearchChange={onSearchChange}
        searchPlaceholder={searchPlaceholder}
        searchId={searchId}
        isSearching={isSearching}
        filterButton={filterButton}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
        clearFiltersLabel={clearFiltersLabel}
        filterChips={filterChips}
        trashToggle={trashToggle}
        viewModeToggle={viewModeToggle}
        columnCustomizer={columnCustomizer}
        primaryAction={primaryAction}
      >
        {children}
      </ModuleWorkToolbar>

      {hasMiddleContent && (statusFilter || dateRange) && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          {statusFilter && statusFilter.options.length > 0 && (
            <div
              role="group"
              aria-label={t("common.statusFilters")}
              className="flex flex-wrap items-center gap-1.5"
            >
              {statusFilter.allLabel && statusFilter.onResetAll && (
                <Button
                  type="button"
                  variant={statusFilter.activeIds.length === 0 ? "secondary" : "ghost"}
                  size="sm"
                  onClick={statusFilter.onResetAll}
                  className="h-8 touch-target-coarse px-2.5 text-xs font-medium"
                >
                  {statusFilter.allLabel}
                </Button>
              )}
              {statusFilter.options.map((option) => {
                const isActive = statusFilter.activeIds.includes(option.id);
                return (
                  <Button
                    key={option.id}
                    type="button"
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => statusFilter.onToggle(option.id)}
                    className={cn(
                      "h-8 touch-target-coarse gap-1.5 px-2.5 text-xs font-medium transition-colors",
                      isActive && "bg-accent font-semibold text-accent-foreground",
                    )}
                  >
                    <span>{option.label}</span>
                    {option.count != null && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "h-5 min-w-5 px-1 text-4xs font-normal leading-none",
                          option.badgeCls,
                        )}
                      >
                        {option.count}
                      </Badge>
                    )}
                  </Button>
                );
              })}
            </div>
          )}

          {dateRange && (
            <div className="flex items-center gap-1.5 text-xs">
              <DatePicker
                id="work-task-date-start"
                name="workTaskDateStart"
                value={dateRange.startDate ?? ""}
                onChange={(val) =>
                  dateRange.onDateRangeChange({
                    start: val || undefined,
                    end: dateRange.endDate,
                  })
                }
                placeholder={dateRange.startPlaceholder ?? t("common.startDate")}
                className="w-32 min-w-0"
                max={dateRange.endDate}
              />
              <span className="text-muted-foreground">–</span>
              <DatePicker
                id="work-task-date-end"
                name="workTaskDateEnd"
                value={dateRange.endDate ?? ""}
                onChange={(val) =>
                  dateRange.onDateRangeChange({
                    start: dateRange.startDate,
                    end: val || undefined,
                  })
                }
                placeholder={dateRange.endPlaceholder ?? t("common.endDate")}
                className="w-32 min-w-0"
                min={dateRange.startDate}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
