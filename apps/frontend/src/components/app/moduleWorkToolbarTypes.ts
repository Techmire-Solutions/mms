import type React from "react";
import type { ModuleColumnRegistryEntry } from "@mms/shared";
import type { ModuleColumnCustomizerLabels } from "@/components/app/ModuleColumnCustomizer";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import type { EntityDescriptor } from "@/components/common/entityRegistryTypes";

/** Trash/archive toggle config shared by every toolbar layer. */
export interface WorkToolbarTrashToggle {
  canViewDeleted: boolean;
  viewingDeleted: boolean;
  onToggle: (viewing: boolean) => void;
  activeLabel: string;
  deletedLabel: string;
}

/** Table/cards segmented control config. */
export interface WorkToolbarViewModeToggle {
  viewMode: WorkDirectoryViewMode;
  onViewModeChange: (mode: WorkDirectoryViewMode) => void;
}

/** Column visibility/order/reset config (adapted onto `ModuleColumnCustomizer`). */
export interface WorkToolbarColumnCustomizer {
  registry?: ModuleColumnRegistryEntry[];
  entityType?: string;
  descriptor?: EntityDescriptor<unknown>;
  onUpdate: (layout: ModuleColumnRegistryEntry[]) => void;
  onReset?: () => void;
  labels?: Partial<ModuleColumnCustomizerLabels>;
  disabled?: boolean;
  className?: string;
}

export interface ModuleWorkToolbarProps {
  // 1. Accessibility & Layout
  shownCountLabel?: string;
  regionLabel: string;
  /**
   * `card` (default) owns the `WORK_SURFACE` chrome; `plain` is for toolbars already
   * nested inside a surface (e.g. `DataTable`) so a page never shows a card-in-card.
   */
  surface?: "card" | "plain";

  // 2. Search
  search: string;
  onSearchChange: (val: string) => void;
  searchPlaceholder: string;
  searchId?: string;
  isSearching?: boolean;
  /**
   * Show the decorative `/` hint and the input's `aria-keyshortcuts`. Only truthful when
   * the consumer wires the focus shortcut for `searchId`; `false` hides both.
   */
  searchShortcutHint?: boolean;

  // 3. Middle Area (Filters)
  filterButton?: React.ReactNode;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  clearFiltersLabel?: string;
  filterChips?: React.ReactNode;

  // 4. Action Bars & Triggers
  primaryAction?: React.ReactNode;

  trashToggle?: WorkToolbarTrashToggle;
  viewModeToggle?: WorkToolbarViewModeToggle;
  columnCustomizer?: WorkToolbarColumnCustomizer;

  // 5. Additional custom slot
  children?: React.ReactNode;
  /** Keep `children` visible in trash mode. Default `true`; modules with export children pass `false`. */
  showExportInTrash?: boolean;
}
