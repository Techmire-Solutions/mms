import type { Faculty, FacultySortField, ModuleColumnRegistryEntry } from "@mms/shared";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";

export type { FacultySortField };

/** Single delete confirm target (page-owned — name for the named confirm copy). */
export interface FacultyDeleteTarget {
  id: string;
  name?: string;
}

export interface FacultyListProps {
  faculty?: Faculty[];
  viewMode: WorkDirectoryViewMode;
  /** Active filter state for the directory empty state (Contacts/Students parity). */
  hasActiveFilters?: boolean;
  /** Clear-filter CTA shown when filters are active and the directory is empty. */
  onClearFilters?: () => void;
  /** "Show active" CTA shown when viewing the trash and the directory is empty. */
  onShowActive?: () => void;
  showDeleted?: boolean;
  canWrite?: boolean;
  canDelete?: boolean;
  selectedIds: string[];
  onSelectOne: (id: string) => void;
  onSelectAll: (pageIds: string[]) => void;
  isColumnVisible?: (key: string) => boolean;
  columnRegistry?: ModuleColumnRegistryEntry[];
  getColumnWidth?: (key: string) => number | undefined;
  onColumnResize?: (key: string, width: number) => void;
  sortField?: FacultySortField;
  sortDir?: "asc" | "desc";
  onSortChange: (field: FacultySortField, dir: "asc" | "desc") => void;
  onView: (faculty: Faculty) => void;
  onEdit: (faculty: Faculty) => void;
  /** Opens the page-owned single-delete confirm (page hoists confirm state). */
  onDeleteTargetChange: (target: FacultyDeleteTarget) => void;
  onRestore?: (id: string) => void | Promise<void>;
  onSms?: (faculty: Faculty[]) => void;
  onWhatsApp?: (faculty: Faculty[]) => void;
  onEmail?: (faculty: Faculty[]) => void;
}
