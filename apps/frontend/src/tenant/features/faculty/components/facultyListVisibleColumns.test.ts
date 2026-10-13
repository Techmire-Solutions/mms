import { describe, expect, it } from "vitest";
import type { ModuleColumnRegistryEntry } from "@mms/shared";
import {
  buildFacultyCustomFieldsById,
  getFacultyVisibleWorkColumns,
  facultyWorkColumnCellClass,
  facultyWorkColumnHeadClass,
  toFacultyListSortField,
} from "../lib/facultyListVisibleColumns";

const mockRegistry: ModuleColumnRegistryEntry[] = [
  { key: "name", label: "Name", enabled: true, fixed: true, order: 0 },
  { key: "employeeId", label: "Employee ID", enabled: true, fixed: false, order: 1 },
  { key: "gender", label: "Gender", enabled: true, fixed: false, order: 2 },
  { key: "phone", label: "Phone", enabled: true, fixed: false, order: 3 },
  { key: "specialization", label: "Specialization", enabled: true, fixed: false, order: 4 },
  { key: "custom:certification", label: "Certification", enabled: true, fixed: false, order: 5 },
  { key: "archived", label: "Archived", enabled: false, fixed: false, order: 6 },
];

describe("getFacultyVisibleWorkColumns", () => {
  it("filters visible columns in registry order", () => {
    const isVisible = (key: string) => key !== "phone" && key !== "archived";
    const result = getFacultyVisibleWorkColumns(mockRegistry, isVisible);

    expect(result.map((col) => col.key)).toEqual([
      "name",
      "employeeId",
      "gender",
      "specialization",
      "custom:certification",
    ]);
  });

  it("excludes face columns when excludeFace is true", () => {
    const isVisible = () => true;
    const result = getFacultyVisibleWorkColumns(mockRegistry, isVisible, { excludeFace: true });

    expect(result.map((col) => col.key)).toEqual([
      "employeeId",
      "gender",
      "phone",
      "specialization",
      "custom:certification",
      "archived",
    ]);
  });
});

describe("toFacultyListSortField", () => {
  it("returns sort field for valid sortable columns", () => {
    expect(toFacultyListSortField("name")).toBe("name");
    expect(toFacultyListSortField("employeeId")).toBe("employeeId");
    expect(toFacultyListSortField("employmentStartDate")).toBe("employmentStartDate");
    expect(toFacultyListSortField("designationEndDate")).toBe("designationEndDate");
    expect(toFacultyListSortField("employDesignationStatus")).toBe("employDesignationStatus");
  });

  it("returns null for non-sortable columns", () => {
    expect(toFacultyListSortField("notes")).toBeNull();
    expect(toFacultyListSortField("custom:certification")).toBeNull();
    expect(toFacultyListSortField("unknown_column")).toBeNull();
  });
});

describe("buildFacultyCustomFieldsById", () => {
  it("builds map for custom:* columns", () => {
    const map = buildFacultyCustomFieldsById(mockRegistry);

    expect(map.size).toBe(1);
    expect(map.get("certification")).toEqual({
      id: "certification",
      label: "Certification",
    });
  });
});

describe("facultyWorkColumn responsive classes", () => {
  it("applies responsive breakpoint classes to department and employment columns", () => {
    expect(facultyWorkColumnCellClass("department")).toContain("hidden sm:table-cell");
    expect(facultyWorkColumnHeadClass("department")).toContain("hidden sm:table-cell");
    expect(facultyWorkColumnCellClass("employeeId")).toContain("hidden sm:table-cell");
    expect(facultyWorkColumnCellClass("employmentStartDate")).toContain("hidden md:table-cell");
    expect(facultyWorkColumnCellClass("designationEndDate")).toContain("hidden md:table-cell");
    expect(facultyWorkColumnCellClass("notes")).toContain("hidden md:table-cell");
    expect(facultyWorkColumnCellClass("custom:certification")).toContain("hidden lg:table-cell");
  });

  it("applies default class for primary columns", () => {
    expect(facultyWorkColumnCellClass("name")).toBe("px-4 py-3");
    expect(facultyWorkColumnHeadClass("name")).toBe("px-4 py-3 text-start");
  });
});
