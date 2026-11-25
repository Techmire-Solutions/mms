import { describe, expect, it, vi } from "vitest";
import {
  buildStudentsWorkTierProps,
  type StudentsWorkTierSource,
} from "./studentsPageWorkTierProps";

const mockSource: StudentsWorkTierSource = {
  studentSearch: "Ahmad",
  studentFilterStatus: ["active"],
  studentFilterGender: "male",
  quickFilter: "all",
  changeQuickFilter: vi.fn(),
  studentStatusOptions: ["active", "inactive"],
  genderFilters: ["all", "male", "female"],
  viewingDeleted: false,
  canWrite: true,
  canDelete: true,
  canExport: true,
  isStatusEnabled: true,
  isGenderEnabled: true,
  bulkActions: ["status", "export"],
  workStudents: [],
  workPageQuery: {
    data: undefined,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  },
  useServerWork: true,
  viewMode: "table",
  setViewMode: vi.fn(),
  columnLayout: {} as never,
  setStudentSearch: vi.fn(),
  toggleStudentStatus: vi.fn(),
  setStudentFilterGender: vi.fn(),
  toggleViewingDeleted: vi.fn(),
  clearFilters: vi.fn(),
  hasActiveFilters: true,
  activeFilterCount: 1,
  selectedIds: ["std-1"],
  selectedTargets: { waTargets: [], smsReady: [], emailReady: [] },
  allSelected: false,
  someSelected: true,
  handleSelectOne: vi.fn(),
  handleSelectAll: vi.fn(),
  clearSelection: vi.fn(),
  setListPage: vi.fn(),
  openEditForm: vi.fn(),
  handleRestore: vi.fn(),
  handleBulkStatusChange: vi.fn(),
  handleBulkExport: vi.fn(),
  bulkStatusPending: false,
  sortField: "name",
  sortDir: "asc",
  handleServerSort: vi.fn(),
  workOverlays: {} as never,
};

describe("buildStudentsWorkTierProps", () => {
  it("maps source controller fields to work tier props", () => {
    const props = buildStudentsWorkTierProps(mockSource);

    expect(props.studentSearch).toBe("Ahmad");
    expect(props.studentFilterStatus).toEqual(["active"]);
    expect(props.studentFilterGender).toBe("male");
    expect(props.canWrite).toBe(true);
    expect(props.selectedIds).toEqual(["std-1"]);
    expect(props.useServerWork).toBe(true);
  });

  it("delegates onRetry to workPageQuery.refetch", () => {
    const refetchSpy = vi.fn();
    const props = buildStudentsWorkTierProps({
      ...mockSource,
      workPageQuery: {
        ...mockSource.workPageQuery,
        refetch: refetchSpy,
      },
    });

    props.onRetry();
    expect(refetchSpy).toHaveBeenCalledTimes(1);
  });
});
