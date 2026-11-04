import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  StudentsFiltersMenuButton,
  resolveStudentsGenderSelection,
  resolveStudentsSortSelection,
} from "./StudentsFiltersMenuButton";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const defaultProps = {
  studentFilterStatus: ["active"],
  studentFilterGender: "male",
  quickFilter: "all" as const,
  onQuickFilterChange: vi.fn(),
  studentStatusOptions: ["active", "inactive"],
  genderFilters: ["male", "female"],
  isStatusEnabled: true,
  isGenderEnabled: true,
  activeFilterCount: 2,
  sortField: "name" as const,
  sortOptions: [{ field: "name" as const, label: "Name" }],
  onToggleStatus: vi.fn(),
  onGenderChange: vi.fn(),
  onSortChange: vi.fn(),
  onClearFilters: vi.fn(),
};

describe("StudentsFiltersMenuButton Component", () => {
  it("renders filter menu button with active count badge", () => {
    const html = renderToStaticMarkup(<StudentsFiltersMenuButton {...defaultProps} />);

    expect(html).toContain("students.filters");
    expect(html).toContain("2");
  });

  it("clears the sort when the None option is selected", () => {
    expect(resolveStudentsSortSelection("none")).toBeNull();
    expect(resolveStudentsSortSelection("grNumber")).toBe("grNumber");
  });

  it("renders the All genders sentinel as the selected default", () => {
    // 2026-11-04 review (M1): with no gender filter the group had no checked option.
    expect(resolveStudentsGenderSelection("")).toBe("all");
    expect(resolveStudentsGenderSelection("male")).toBe("male");
  });
});
