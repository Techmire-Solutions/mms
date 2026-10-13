import React, { type JSX } from "react";
import { SearchBar } from "@/components/ui/SearchBar";
import { ModuleClearFiltersButton } from "@/components/ui/ModuleClearFiltersButton";
import { ModuleTrashToggle } from "@/components/ui/ModuleTrashToggle";
import { WorkViewModeToggle } from "@/components/ui/WorkViewModeToggle";
import { ModuleColumnCustomizer } from "@/components/ui/ModuleColumnCustomizer";
import { WORK_SURFACE } from "@/components/ui/formStyles";
import { cn } from "@/lib/utils";
import type { ModuleWorkToolbarProps } from "@/components/ui/moduleWorkToolbarTypes";

export type { ModuleWorkToolbarProps };

export const ModuleWorkToolbar = function ModuleWorkToolbar({
  shownCountLabel,
  regionLabel,
  search,
  onSearchChange,
  searchPlaceholder,
  searchId,
  isSearching,
  filterButton,
  hasActiveFilters,
  onClearFilters,
  clearFiltersLabel,
  filterChips,
  primaryAction,
  trashToggle,
  viewModeToggle,
  columnCustomizer,
  densityToggle,
  aiSuggestions,
  children,
  showExportInTrash = true,
}: ModuleWorkToolbarProps): JSX.Element {
  const showChildren = Boolean(
    children && (!trashToggle?.viewingDeleted || showExportInTrash !== false),
  );
  const hasFilterControls = Boolean(
    showChildren ||
    filterButton ||
    (hasActiveFilters && onClearFilters) ||
    (!trashToggle?.viewingDeleted && primaryAction) ||
    trashToggle?.canViewDeleted,
  );
  const hasLayoutControls = Boolean(
    viewModeToggle ||
    (columnCustomizer &&
      (Boolean(columnCustomizer.registry?.length) ||
        Boolean(columnCustomizer.entityType) ||
        Boolean(columnCustomizer.descriptor))),
  );

  return (
    <>
      {shownCountLabel ? (
        <div className="sr-only" role="status" aria-live="polite">
          {shownCountLabel}
        </div>
      ) : null}

      {aiSuggestions && (
        <div
          className="flex items-center gap-2 flex-wrap px-3 pt-2.5 pb-0"
          aria-description="AI-generated"
          aria-label="Smart filter suggestions"
        >
          {aiSuggestions}
        </div>
      )}

      <div
        role="region"
        aria-label={regionLabel}
        className={cn(
          WORK_SURFACE,
          // `lg:gap-7` (28px), not the 2.5px-scaled base gap: when the actions group sits
          // BESIDE the search at lg widths, axe measures the gap to the nearest control
          // (the active tab) and WCAG 2.2 `target-size` (2.5.8) requires 24px of clear
          // space. At 10px it measured 16px — under the floor — with the wide tablist
          // (`All (118)`) leaving `#<searchId>` only 86px of room.
          "flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 lg:gap-7 p-2.5 sm:p-3",
        )}
      >
        <div className="relative min-w-0 flex-1 w-full lg:max-w-md xl:max-w-lg">
          <SearchBar
            id={searchId}
            value={search}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
            isSearching={isSearching}
            className="w-full min-w-0"
          />
          {!search && (
            // Decorative hint — `aria-hidden` and non-interactive, so it is not a control
            // and not a touch target. (Not a fix for the toolbar's `target-size` failure:
            // axe attributes that to the active tab crowding the input on wide counts.)
            <span
              aria-hidden="true"
              className="pointer-events-none absolute end-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 md:flex select-none"
            >
              <kbd className="rounded border border-border/60 bg-muted/60 px-1.5 py-0.5 font-mono text-3xs font-medium text-muted-foreground shadow-2xs">
                /
              </kbd>
            </span>
          )}
        </div>

        {/*
          `min-w-0`, not `shrink-0`: the group declares `flex-wrap`, so forbidding it from
          ever shrinking was self-contradictory. NOTE: this alone did NOT clear the
          `target-size` failure — it was measured at 0/5 before and after. The actual fix
          is the `lg:gap-7` on the region above (the criterion is spacing to the neighbour).
        */}
        <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2 min-w-0">
          {showChildren && children}

          {filterButton}

          {hasActiveFilters && onClearFilters && clearFiltersLabel && (
            <ModuleClearFiltersButton onClearFilters={onClearFilters} label={clearFiltersLabel} />
          )}

          {!trashToggle?.viewingDeleted && primaryAction}

          {trashToggle?.canViewDeleted && (
            <ModuleTrashToggle
              showDeleted={trashToggle.viewingDeleted}
              onToggle={() => trashToggle.onToggle(!trashToggle.viewingDeleted)}
              showActiveLabel={trashToggle.activeLabel}
              showDeletedLabel={trashToggle.deletedLabel}
            />
          )}

          {hasFilterControls && hasLayoutControls && (
            <div className="h-6 w-px bg-border/60 mx-0.5 hidden sm:block" aria-hidden="true" />
          )}

          {hasLayoutControls && (
            <div className="inline-flex items-center gap-2">
              {viewModeToggle && (
                <WorkViewModeToggle
                  viewMode={viewModeToggle.viewMode}
                  onViewModeChange={viewModeToggle.onViewModeChange}
                />
              )}

              {columnCustomizer &&
                (columnCustomizer.registry ||
                  columnCustomizer.entityType ||
                  columnCustomizer.descriptor) && (
                  <ModuleColumnCustomizer
                    columnRegistry={columnCustomizer.registry}
                    entityType={columnCustomizer.entityType}
                    descriptor={columnCustomizer.descriptor}
                    updateUserColumnLayout={columnCustomizer.onUpdate}
                    onResetLayout={columnCustomizer.onReset}
                    labels={columnCustomizer.labels}
                    disabled={columnCustomizer.disabled}
                    className={columnCustomizer.className}
                  />
                )}
            </div>
          )}
        </div>
      </div>

      {filterChips}
    </>
  );
};
