import type React from "react";
import type { ModuleColumnRegistryEntry } from "@mms/shared";
import type { ModuleColumnCustomizerLabels } from "@/components/app/ModuleColumnCustomizer";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import type { EntityDescriptor } from "@/components/common/entityRegistryTypes";

export interface WorkTaskStatusOption {
  id: string;
  label: string;
  count?: number;
  badgeCls?: string;
}

export interface WorkTaskToolbarProps {
  // Accessibility & Regions
  regionLabel: string;
  shownCountLabel?: string;

  // Search
  search: string;
  onSearchChange: (val: string) => void;
  searchPlaceholder: string;
  searchId?: string;
  isSearching?: boolean;

  // Status Filter Pills (optional quick filters)
  statusFilter?: {
    activeIds: string[];
    options: WorkTaskStatusOption[];
    onToggle: (id: string) => void;
    allLabel?: string;
    onResetAll?: () => void;
  };

  // Date Range Controls (optional)
  dateRange?: {
    startDate?: string;
    endDate?: string;
    onDateRangeChange: (range: { start?: string; end?: string }) => void;
    startPlaceholder?: string;
    endPlaceholder?: string;
  };

  // Custom filter menu/button slot
  filterButton?: React.ReactNode;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  clearFiltersLabel?: string;
  filterChips?: React.ReactNode;

  // Layout & directory toggles
  trashToggle?: {
    canViewDeleted: boolean;
    viewingDeleted: boolean;
    onToggle: (v: boolean) => void;
    activeLabel: string;
    deletedLabel: string;
  };

  viewModeToggle?: {
    viewMode: WorkDirectoryViewMode;
    onViewModeChange: (m: WorkDirectoryViewMode) => void;
  };

  columnCustomizer?: {
    registry?: ModuleColumnRegistryEntry[];
    entityType?: string;
    descriptor?: EntityDescriptor<unknown>;
    onUpdate: (layout: ModuleColumnRegistryEntry[]) => void;
    onReset?: () => void;
    labels?: Partial<ModuleColumnCustomizerLabels>;
    disabled?: boolean;
    className?: string;
  };

  // Action slots
  primaryAction?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}
