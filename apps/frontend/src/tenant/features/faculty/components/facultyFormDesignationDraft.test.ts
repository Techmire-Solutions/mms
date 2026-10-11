import { describe, expect, it } from "vitest";
import type { FacultyDesignationDefinition } from "@mms/shared";
import {
  buildDesignationDraftPatch,
  selectableDesignationOptions,
} from "./facultyFormDesignationDraft";

const designation = (
  overrides: Partial<FacultyDesignationDefinition>,
): FacultyDesignationDefinition => ({
  id: "des-1",
  departmentId: "dept-1",
  name: "Lecturer",
  parentDesignationId: null,
  status: "active",
  assignableRoles: [],
  ...overrides,
});

describe("buildDesignationDraftPatch", () => {
  it("given a designation with a hydrated department name, should project designation, department, parent and roles", () => {
    // Arrange
    const def = designation({
      id: "hod",
      name: "Head of Department",
      departmentName: "Hadith",
      parentDesignationId: "dean",
      assignableRoles: ["teacher", "department_manager"],
    });

    // Act
    const patch = buildDesignationDraftPatch(def);

    // Assert
    expect(patch).toEqual({
      designationId: "hod",
      designation: "Head of Department",
      designationAssignableRoles: ["teacher", "department_manager"],
      parentDesignationId: "dean",
      departmentId: "dept-1",
      department: "Hadith",
    });
  });

  it("given no hydrated department name, should resolve it from the department entities", () => {
    // Act
    const patch = buildDesignationDraftPatch(designation({}), [{ id: "dept-1", name: "Fiqh" }]);

    // Assert
    expect(patch.department).toBe("Fiqh");
  });

  it("given no designation, should clear every designation-derived field", () => {
    // Act
    const patch = buildDesignationDraftPatch(undefined);

    // Assert
    expect(patch).toEqual({
      designationId: "",
      designation: "",
      designationAssignableRoles: [],
      parentDesignationId: null,
      departmentId: "",
      department: "",
    });
  });
});

describe("selectableDesignationOptions", () => {
  it("given inactive and archived rows, should keep only active ones plus the currently held designation", () => {
    // Arrange
    const options = [
      designation({ id: "active", name: "Active" }),
      designation({ id: "inactive", name: "Inactive", status: "inactive" }),
      designation({ id: "held", name: "Held", status: "inactive" }),
      designation({ id: "archived", name: "Archived", deletedAt: "2026-01-01T00:00:00Z" }),
    ];

    // Act
    const result = selectableDesignationOptions(options, "held").map((d) => d.id);

    // Assert
    expect(result).toEqual(["active", "held"]);
  });

  it("given mixed departments and ranks, should order by department, then seniority, then name", () => {
    // Arrange
    const options = [
      designation({ id: "b2", name: "Zeta", departmentName: "B", hierarchyRank: 2 }),
      designation({ id: "a2", name: "Beta", departmentName: "A", hierarchyRank: 2 }),
      designation({ id: "a1", name: "Alpha", departmentName: "A", hierarchyRank: 1 }),
      designation({ id: "a2b", name: "Alpha2", departmentName: "A", hierarchyRank: 2 }),
    ];

    // Act
    const result = selectableDesignationOptions(options).map((d) => d.id);

    // Assert
    expect(result).toEqual(["a1", "a2b", "a2", "b2"]);
  });
});
