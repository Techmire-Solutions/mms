import { describe, expect, it } from "vitest";
import {
  collectDesignationDescendantIds,
  facultyDesignationAssignmentWriteSchema,
  facultyDesignationWriteSchema,
  formatDesignationOptionLabel,
  resolveDesignationHierarchyRank,
} from "./facultyDesignationTypes.js";
import { isFacultyCatalogRowActive } from "./facultyDepartmentTypes.js";

describe("facultyDesignationWriteSchema", () => {
  it("given a department-scoped designation with a parent, should default status to active", () => {
    // Arrange
    const payload = {
      id: "hafiz-teacher",
      departmentId: "dept-hifz",
      name: "Hafiz Teacher",
      parentDesignationId: "head-of-hifz",
    };

    // Act
    const result = facultyDesignationWriteSchema.parse(payload);

    // Assert
    expect(result).toEqual({ ...payload, status: "active" });
  });

  it("given a designation that references itself as parent, should reject the write", () => {
    // Arrange
    const payload = {
      id: "alim",
      departmentId: "dept-1",
      name: "Alim",
      parentDesignationId: "alim",
    };

    // Act
    const result = facultyDesignationWriteSchema.safeParse(payload);

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["parentDesignationId"]);
    }
  });

  it("given assignableRoles, should accept a single WorkspaceRole id on write", () => {
    const payload = {
      id: "lecturer",
      departmentId: "dept-1",
      name: "Lecturer",
      assignableRoles: ["staff"],
    };
    const result = facultyDesignationWriteSchema.parse(payload);
    expect(result.assignableRoles).toEqual(["staff"]);
    expect(result.status).toBe("active");
  });

  it("given more than one assignable role, should reject the write", () => {
    const payload = {
      id: "lecturer",
      departmentId: "dept-1",
      name: "Lecturer",
      assignableRoles: ["staff", "instructor"],
    };
    expect(facultyDesignationWriteSchema.safeParse(payload).success).toBe(false);
  });

  it("given legacy code/rank attributes, should reject unknown keys via strict()", () => {
    // Arrange
    const payload = {
      id: "lecturer",
      departmentId: "dept-1",
      name: "Lecturer",
      code: "LECT",
      hierarchyRank: 4,
    };

    // Act
    const result = facultyDesignationWriteSchema.safeParse(payload);

    // Assert
    expect(result.success).toBe(false);
  });

  it("given a missing departmentId, should reject the write", () => {
    // Arrange
    const payload = { id: "lecturer", name: "Lecturer" };

    // Act
    const result = facultyDesignationWriteSchema.safeParse(payload);

    // Assert
    expect(result.success).toBe(false);
  });
});

describe("designation hierarchy helpers", () => {
  const tree = [
    { id: "dean", parentDesignationId: null },
    { id: "hod", parentDesignationId: "dean" },
    { id: "senior", parentDesignationId: "hod" },
    { id: "lecturer", parentDesignationId: "senior" },
    { id: "admin", parentDesignationId: null },
  ];

  it("given a root node, should collect itself and every descendant", () => {
    // Act
    const ids = collectDesignationDescendantIds(tree, "hod");

    // Assert
    expect([...ids].sort()).toEqual(["hod", "lecturer", "senior"]);
  });

  it("given a chain, should resolve the 1-based depth as hierarchy rank", () => {
    // Act / Assert
    expect(resolveDesignationHierarchyRank(tree, "dean")).toBe(1);
    expect(resolveDesignationHierarchyRank(tree, "lecturer")).toBe(4);
    expect(resolveDesignationHierarchyRank(tree, "admin")).toBe(1);
  });

  it("given a cyclic chain, should return null instead of looping", () => {
    // Arrange
    const cyclic = [
      { id: "a", parentDesignationId: "b" },
      { id: "b", parentDesignationId: "a" },
    ];

    // Act
    const rank = resolveDesignationHierarchyRank(cyclic, "a");

    // Assert
    expect(rank).toBeNull();
  });

  it('given a department name, should format "Department · Designation" labels', () => {
    // Act / Assert
    expect(formatDesignationOptionLabel({ name: "Alim", departmentName: "Dars-e-Nizami" })).toBe(
      "Dars-e-Nizami · Alim",
    );
    expect(formatDesignationOptionLabel({ name: "Alim" })).toBe("Alim");
  });

  it('given a role label, should append " · Role" to the designation option label', () => {
    expect(
      formatDesignationOptionLabel({ name: "Alim", departmentName: "Dars-e-Nizami" }, "Teacher"),
    ).toBe("Dars-e-Nizami · Alim · Teacher");
    expect(formatDesignationOptionLabel({ name: "Alim" }, "  ")).toBe("Alim");
    expect(formatDesignationOptionLabel({ name: "Alim" }, null)).toBe("Alim");
  });
});

describe("isFacultyCatalogRowActive", () => {
  it("given status, should prefer it over legacy isActive", () => {
    expect(isFacultyCatalogRowActive({ status: "active", isActive: false })).toBe(true);
    expect(isFacultyCatalogRowActive({ status: "inactive", isActive: true })).toBe(false);
  });

  it("given no status, should fall back to isActive and treat deleted rows as inactive", () => {
    expect(isFacultyCatalogRowActive({ isActive: true })).toBe(true);
    expect(isFacultyCatalogRowActive({ isActive: false })).toBe(false);
    expect(isFacultyCatalogRowActive({ status: "active", deletedAt: "2026-01-01T00:00:00Z" })).toBe(
      false,
    );
  });
});

describe("facultyDesignationAssignmentWriteSchema", () => {
  it("given an open-ended period, should accept a null end date", () => {
    // Arrange
    const payload = {
      id: "assignment-1",
      facultyId: "faculty-1",
      designationId: "head-of-department",
      startsOn: "2026-09-23",
      endsOn: null,
    };

    // Act
    const result = facultyDesignationAssignmentWriteSchema.parse(payload);

    // Assert
    expect(result.endsOn).toBeNull();
  });

  it("given an end date before the start date, should reject the period", () => {
    // Arrange
    const payload = {
      id: "assignment-1",
      facultyId: "faculty-1",
      designationId: "head-of-department",
      startsOn: "2026-09-23",
      endsOn: "2026-09-22",
    };

    // Act
    const result = facultyDesignationAssignmentWriteSchema.safeParse(payload);

    // Assert
    expect(result.success).toBe(false);
  });
});
