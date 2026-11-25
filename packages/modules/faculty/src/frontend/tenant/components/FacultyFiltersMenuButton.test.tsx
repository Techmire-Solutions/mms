import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FacultyFiltersMenuButton } from "./FacultyFiltersMenuButton";

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const defaultProps = {
  filterStatus: ["active"],
  filterSpecialization: "Tajweed",
  filterGender: "male",
  filterDepartment: "",
  filterDesignation: "",
  filterReportingFacultyId: "",
  departmentFilterOptions: [{ value: "Academics", label: "Academics" }],
  designationFilterOptions: [{ value: "Teacher", label: "Teacher" }],
  supervisorFilterOptions: [{ value: "fac-1", label: "Dean" }],
  quickFilter: "all" as const,
  onQuickFilterChange: vi.fn(),
  genderFilters: ["male", "female"],
  statusOptions: ["active", "inactive"],
  specializationOptions: ["Tajweed", "Hadith"],
  activeFilterCount: 3,
  sortField: "name" as const,
  sortOptions: [{ field: "name" as const, label: "Name" }],
  onToggleStatus: vi.fn(),
  onSpecializationChange: vi.fn(),
  onGenderChange: vi.fn(),
  onDepartmentChange: vi.fn(),
  onDesignationChange: vi.fn(),
  onReportingFacultyChange: vi.fn(),
  onSortChange: vi.fn(),
  onClearFilters: vi.fn(),
};

describe("FacultyFiltersMenuButton Component", () => {
  it("renders filter menu button with active count badge", () => {
    const html = renderToStaticMarkup(<FacultyFiltersMenuButton {...defaultProps} />);

    expect(html).toContain("faculty.filters");
    expect(html).toContain("3");
  });
});
