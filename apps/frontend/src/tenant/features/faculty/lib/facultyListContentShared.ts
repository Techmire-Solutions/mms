import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import type {
  Faculty,
  FacultyCustomField,
  FacultySortField,
  ModuleColumnRegistryEntry,
} from "@mms/shared";
import type { StatusBadgeConfigItem } from "@/components/app/StatusBadge";

export interface FacultyListContentProps {
  viewMode: WorkDirectoryViewMode;
  /** All faculty members to render in the directory. */
  faculty?: Faculty[];
  selectedIds: string[];

  allSelected: boolean;
  someSelected: boolean;
  showDeleted: boolean;
  canWrite: boolean;
  canDelete: boolean;
  /** Active filter state for the directory empty state (Contacts/Students parity). */
  hasActiveFilters: boolean;
  /** Clear-filter CTA shown when filters are active and the directory is empty. */
  onClearFilters?: () => void;
  /** "Show active" CTA shown when viewing the trash and the directory is empty. */
  onShowActive?: () => void;
  /** Column visibility gate — prefer over parallel show* booleans. */
  isColumnVisible: (key: string) => boolean;
  /** Live Work column layout (tenant registry + user overlay). */
  columnRegistry: ModuleColumnRegistryEntry[];
  /** Custom column id → label map (lifted once for table + cards). */
  customFieldsById: Map<string, FacultyCustomField>;
  statusConfig: Record<string, StatusBadgeConfigItem>;
  sortField: FacultySortField;
  sortDir: "asc" | "desc";
  getColumnWidth?: (key: string) => number | undefined;
  onColumnResize?: (key: string, width: number) => void;
  onSort: (field: FacultySortField) => void;
  onSelectAll: () => void;
  onSelectOne: (id: string) => void;
  onView: (faculty: Faculty) => void;
  onEdit: (faculty: Faculty) => void;
  onRequestDelete: (id: string) => void;
  onRestore?: (id: string) => void;
  onSms?: (faculty: Faculty[]) => void;
  onWhatsApp?: (faculty: Faculty[]) => void;
  onEmail?: (faculty: Faculty[]) => void;
}
