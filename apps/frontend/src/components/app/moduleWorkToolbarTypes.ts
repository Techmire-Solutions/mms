import type React from "react";
import type { ModuleColumnRegistryEntry } from "@mms/shared";
import type { ModuleColumnCustomizerLabels } from "@/components/app/ModuleColumnCustomizer";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import type { EntityDescriptor } from "@/components/common/entityRegistryTypes";

export interface ModuleWorkToolbarProps {
  // 1. Accessibility & Layout
  shownCountLabel?: string;
  regionLabel: string;

  // 2. Search
  search: string;
  onSearchChange: (val: string) => void;
  searchPlaceholder: string;
  searchId?: string;
  isSearching?: boolean;

  // 3. Middle Area (Filters)
  filterButton?: React.ReactNode;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  clearFiltersLabel?: string;
  filterChips?: React.ReactNode;

  // 4. Action Bars & Triggers
  primaryAction?: React.ReactNode;

  trashToggle?: {
    canViewDeleted: boolean;
    viewingDeleted: boolean;
    onToggle: (viewing: boolean) => void;
    activeLabel?: string;
    deletedLabel?: string;
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

  // 5. Density & AI
  /** Optional row-density toggle — renders Compact/Default/Relaxed control. Pass current density and a setter. */
  densityToggle?: {
    density: "compact" | "default" | "relaxed";
    onChange: (d: "compact" | "default" | "relaxed") => void;
  };
  /** Optional AI-generated contextual filter suggestions to show above the toolbar. */
  aiSuggestions?: React.ReactNode;

  // 6. Additional custom slot
  children?: React.ReactNode;
  showExportInTrash?: boolean;
}
