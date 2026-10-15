import React from "react";
import type { ModuleColumnCustomizerProps } from "@/components/app/ModuleColumnCustomizer";
import { FilterChips } from "@/components/app/FilterChips";
import { WorkTaskToolbar } from "./WorkTaskToolbar";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";

export interface WorkListFilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

export interface WorkListTrashToggle {
  canViewDeleted: boolean;
  viewingDeleted: boolean;
  onToggle: () => void;
  activeLabel: string;
  deletedLabel: string;
}

export interface WorkListFiltersScaffoldProps {
  regionLabel: string;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  searchId: string;
  activeFilterCount: number;
  clearFiltersLabel: string;
  onClearFilters: () => void;
  filterButton?: React.ReactNode;
  chips: WorkListFilterChip[];
  trashToggle?: WorkListTrashToggle;
  viewModeToggle?: {
    viewMode: WorkDirectoryViewMode;
    onViewModeChange: (mode: WorkDirectoryViewMode) => void;
  };
  /** Module-owned column layout plumbing, normalized onto the toolbar. */
  columnCustomizer?: ModuleColumnCustomizerProps;
  children?: React.ReactNode;
}

/**
 * Shared chassis for module Work-tier list filter bars: composes
 * `WorkTaskToolbar` + `FilterChips` and normalizes the column-customizer
 * shape. Module files stay responsible for filter option derivation, the
 * filter menu button, and translated labels.
 */
export function WorkListFiltersScaffold({
  regionLabel,
  search,
  onSearchChange,
  searchPlaceholder,
  searchId,
  activeFilterCount,
  clearFiltersLabel,
  onClearFilters,
  filterButton,
  chips,
  trashToggle,
  viewModeToggle,
  columnCustomizer,
  children,
}: WorkListFiltersScaffoldProps): React.JSX.Element {
  return (
    <WorkTaskToolbar
      regionLabel={regionLabel}
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder={searchPlaceholder}
      searchId={searchId}
      hasActiveFilters={activeFilterCount > 0}
      onClearFilters={onClearFilters}
      clearFiltersLabel={clearFiltersLabel}
      filterButton={filterButton}
      filterChips={<FilterChips chips={chips} onClearAll={onClearFilters} />}
      trashToggle={
        trashToggle && trashToggle.canViewDeleted ? { ...trashToggle } : undefined
      }
      viewModeToggle={viewModeToggle}
      columnCustomizer={
        columnCustomizer
          ? {
              registry: columnCustomizer.columnRegistry,
              onUpdate: columnCustomizer.updateUserColumnLayout,
              onReset: columnCustomizer.onResetLayout,
              labels: columnCustomizer.labels,
            }
          : undefined
      }
    >
      {children}
    </WorkTaskToolbar>
  );
}
