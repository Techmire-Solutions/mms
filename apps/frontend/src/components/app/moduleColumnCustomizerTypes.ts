import type React from "react";
import type { ModuleColumnRegistryEntry } from "@mms/shared";
import type { EntityDescriptor } from "@/types/entityRegistry";

export interface ModuleColumnCustomizerLabels {
  trigger: string;
  title: string;
  visibleAndOrder: string;
  hidden: string;
  fixed: string;
  hideColumn: (label: string) => string;
  showColumn?: (label: string) => string;
  reset?: string;
  searchPlaceholder?: string;
  showAll?: string;
  hideAll?: string;
  visibleCount?: (visible: number, total: number) => string;
  noMatches?: string;
}

export interface ModuleColumnCustomizerProps {
  columnRegistry?: ModuleColumnRegistryEntry[];
  entityType?: string;
  descriptor?: EntityDescriptor<unknown>;
  updateUserColumnLayout: (columnRegistry: ModuleColumnRegistryEntry[]) => void;
  onResetLayout?: () => void;
  labels?: Partial<ModuleColumnCustomizerLabels>;
  className?: string;
  disabled?: boolean;
}

export interface ModuleColumnCustomizerListProps {
  visibleColumns: ModuleColumnRegistryEntry[];
  hiddenColumns: ModuleColumnRegistryEntry[];
  dragging: string | null;
  dragOver: string | null;
  labels: ModuleColumnCustomizerLabels;
  toggle: (columnKey: string) => void;
  handleDragStart: (event: React.DragEvent<HTMLDivElement>, columnKey: string) => void;
  handleDragOver: (event: React.DragEvent<HTMLDivElement>, columnKey: string) => void;
  handleDrop: (event: React.DragEvent<HTMLDivElement>, targetColumnKey: string) => void;
  clearDrag: () => void;
  onMoveColumn?: (columnKey: string, direction: "up" | "down") => void;
  showAll?: () => void;
  hideAll?: () => void;
  hasNonFixedHidden?: boolean;
  hasNonFixedVisible?: boolean;
  isSearching?: boolean;
}
