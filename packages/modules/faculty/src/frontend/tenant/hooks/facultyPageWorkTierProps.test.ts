import { describe, expect, it, vi } from "vitest";
import { buildFacultyWorkTierProps, type FacultyWorkTierSource } from "./facultyPageWorkTierProps";

const mockSource: FacultyWorkTierSource = {
  search: "Umar",
  filterStatus: ["active"],
  filterSpecialization: "Tajweed",
  filterGender: "male",
  filterDepartment: "",
  filterDesignation: "",
  filterReportingFacultyId: "",
  quickFilter: "all",
  changeQuickFilter: vi.fn(),
  genderFilters: ["all", "male", "female"],
  activeFilterCount: 1,
  statusOptions: ["active", "inactive"],
  specializationOptions: ["Tajweed", "Hadith"],
  departmentFilterOptions: [],
  designationFilterOptions: [],
  supervisorFilterOptions: [],
  showDeleted: false,
  canWrite: true,
  canDelete: true,
  canExport: true,
  hasActiveFilters: true,
  columnRegistry: [],
  isColumnVisible: () => true,
  getColumnWidth: () => undefined,
  onColumnResize: vi.fn(),
  updateUserColumnLayout: vi.fn(),
  onResetLayout: vi.fn(),
  customizerLabels: {} as never,
  faculty: [],
  workPageQuery: {
    data: undefined,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  },
  useServerWork: true,
  selectedIds: ["tch-1"],
  handleSelectOne: vi.fn(),
  handleSelectAll: vi.fn(),
  clearSelection: vi.fn(),
  handleBulkExport: vi.fn(),
  sortField: "name",
  sortDir: "asc",
  onSortChange: vi.fn(),
  setSearch: vi.fn(),
  toggleStatus: vi.fn(),
  setFilterSpecialization: vi.fn(),
  setFilterGender: vi.fn(),
  setFilterDepartment: vi.fn(),
  setFilterDesignation: vi.fn(),
  setFilterReportingFacultyId: vi.fn(),
  toggleViewingDeleted: vi.fn(),
  clearFilters: vi.fn(),
  onRetry: vi.fn(),
  openEditForm: vi.fn(),
  handleRestore: vi.fn(),
  handleBulkStatusChange: vi.fn(),
  bulkStatusPending: false,
  handleWhatsApp: vi.fn(),
  handleSms: vi.fn(),
  handleEmail: vi.fn(),
  setListPage: vi.fn(),
  viewMode: "table",
  setViewMode: vi.fn(),
  workOverlays: {} as never,
};

describe("buildFacultyWorkTierProps", () => {
  it("maps source controller fields to faculty work tier props", () => {
    const props = buildFacultyWorkTierProps(mockSource);

    expect(props.search).toBe("Umar");
    expect(props.filterStatus).toEqual(["active"]);
    expect(props.filterSpecialization).toBe("Tajweed");
    expect(props.canWrite).toBe(true);
    expect(props.selectedIds).toEqual(["tch-1"]);
  });
});
