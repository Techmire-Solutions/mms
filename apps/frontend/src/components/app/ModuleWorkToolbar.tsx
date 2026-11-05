import React, { type JSX } from "react";
import { SearchBar } from "@/components/app/SearchBar";
import { ModuleClearFiltersButton } from "@/components/app/ModuleClearFiltersButton";
import { ModuleTrashToggle } from "@/components/app/ModuleTrashToggle";
import { WorkViewModeToggle } from "@/components/app/WorkViewModeToggle";
import { ModuleColumnCustomizer } from "@/components/app/ModuleColumnCustomizer";
import { WORK_SURFACE } from "@/components/ui/formStyles";
import { useRovingToolbar } from "@/hooks/useRovingToolbar";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import type { ModuleWorkToolbarProps } from "@/components/app/moduleWorkToolbarTypes";

export type { ModuleWorkToolbarProps };

export const ModuleWorkToolbar = function ModuleWorkToolbar({
  shownCountLabel,
  regionLabel,
  search,
  onSearchChange,
  searchPlaceholder,
  searchId,
  isSearching,
  searchShortcutHint = true,
  filterButton,
  hasActiveFilters,
  onClearFilters,
  clearFiltersLabel,
  filterChips,
  primaryAction,
  trashToggle,
  viewModeToggle,
  columnCustomizer,
  surface = "card",
  children,
  showExportInTrash = true,
}: ModuleWorkToolbarProps): JSX.Element {
  const { t } = useTranslation();
  const layoutToolbarRef = useRovingToolbar<HTMLDivElement>({ selector: "button" });
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

      <div
        role="region"
        aria-label={regionLabel}
        className={cn(
          surface === "card" && WORK_SURFACE,
          // Below `xl` the toolbar stacks: the search field must stay usable (the
          // 1024–1279 single-row layout crushed it to ~118 px and clipped the
          // placeholder). At `xl` the 28 px neighbour gap replaces the scaled base gap
          // so WCAG 2.2 `target-size` (2.5.8) still measures 24 px+ of clear space.
          "flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-2.5 xl:gap-7",
          surface === "card" && "p-2.5 sm:p-3",
        )}
      >
        <div className="relative min-w-0 w-full flex-1 xl:min-w-80 xl:max-w-lg">
          <SearchBar
            id={searchId}
            value={search}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
            isSearching={isSearching}
            keyshortcuts={searchId && searchShortcutHint ? "/" : null}
            className="w-full min-w-0"
          />
          {!search && searchShortcutHint && searchId && (
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
          is the `xl:gap-7` on the region above (the criterion is spacing to the neighbour).
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
              viewingDeleted={trashToggle.viewingDeleted}
              onToggle={() => trashToggle.onToggle(!trashToggle.viewingDeleted)}
              activeLabel={trashToggle.activeLabel}
              deletedLabel={trashToggle.deletedLabel}
            />
          )}

          {hasFilterControls && hasLayoutControls && (
            <div className="h-6 w-px bg-border/60 mx-0.5 hidden sm:block" aria-hidden="true" />
          )}

          {hasLayoutControls && (
            <div
              ref={layoutToolbarRef}
              role="toolbar"
              aria-label={t("common.layoutTools")}
              className="inline-flex items-center gap-2"
            >
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
