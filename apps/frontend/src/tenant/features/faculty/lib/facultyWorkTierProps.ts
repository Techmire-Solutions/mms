import type {
  FacultyListPageResult,
  FacultyMember,
  FacultyQuickFilter,
  FacultySortField,
  ModuleColumnRegistryEntry,
} from "@mms/shared";
import type { ModuleColumnCustomizerLabels } from "@/components/ui/ModuleColumnCustomizer";
import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import type { FacultyWorkOverlayInteractions } from "@/tenant/features/faculty/hooks/facultyPageOverlaysTypes";

export interface FacultyWorkTierProps {
  search: string;
  filterStatus: string[];
  filterSpecialization: string;
  filterGender: string;
  filterDepartment: string;
  filterDesignation: string;
  filterReportingFacultyId: string;
  quickFilter: FacultyQuickFilter;
  onQuickFilterChange: (preset: string) => void;
  genderFilters: string[];
  activeFilterCount: number;
  statusOptions: string[];
  specializationOptions: string[];
  departmentFilterOptions: Array<{ value: string; label: string }>;
  designationFilterOptions: Array<{ value: string; label: string }>;
  supervisorFilterOptions: Array<{ value: string; label: string }>;
  showDeleted: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canExport?: boolean;
  hasActiveFilters: boolean;
  columnRegistry: ModuleColumnRegistryEntry[];
  isColumnVisible: (key: string) => boolean;
  getColumnWidth: (key: string) => number | undefined;
  onColumnResize: (key: string, width: number) => void;
  updateUserColumnLayout: (columnRegistry: ModuleColumnRegistryEntry[]) => void;
  onResetLayout: () => void;
  customizerLabels: ModuleColumnCustomizerLabels;
  faculty?: FacultyMember[];
  workPageData?: FacultyListPageResult;
  isWorkPageLoading: boolean;
  isWorkPageError: boolean;
  isWorkPageFetching: boolean;
  useServerWork: boolean;
  selectedIds: string[];
  onSelectOne: (id: string) => void;
  onSelectAll: (pageIds: string[]) => void;
  onClearSelection: () => void;
  onBulkExport?: () => void | Promise<void>;
  sortField: FacultySortField;
  sortDir: "asc" | "desc";
  onSearchChange: (value: string) => void;
  onToggleStatus: (status: string) => void;
  onSpecializationChange: (value: string) => void;
  onGenderChange: (value: string) => void;
  onDepartmentChange: (value: string) => void;
  onDesignationChange: (value: string) => void;
  onReportingFacultyChange: (value: string) => void;
  onToggleDeleted: () => void;
  onClearFilters: () => void;
  onRetry: () => unknown;
  onEdit: (faculty: FacultyMember) => void;
  onRestore: (id: string) => void | Promise<void>;
  onBulkStatusChange?: (ids: string[], status: string) => void | Promise<void>;
  bulkStatusPending?: boolean;
  onBulkSpecializationChange?: (ids: string[], specialization: string) => void | Promise<void>;
  bulkSpecializationPending?: boolean;
  onWhatsApp?: (faculty: FacultyMember[]) => void;
  onSms?: (faculty: FacultyMember[]) => void;
  onEmail?: (faculty: FacultyMember[]) => void;
  onSortChange: (field: FacultySortField, dir: "asc" | "desc") => void;
  onPageChange: (page: number) => void;
  viewMode: WorkDirectoryViewMode;
  onViewModeChange: (mode: WorkDirectoryViewMode) => void;
  /** Page-owned overlay interactions (composer, confirms, drawer target). */
  workOverlays: FacultyWorkOverlayInteractions;
}
