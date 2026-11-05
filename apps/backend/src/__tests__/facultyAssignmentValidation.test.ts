import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertFacultyAssignmentDeletable,
  validateFacultyAssignment,
} from "../db/repositories/facultyAssignmentValidation.js";
import {
  FacultyCatalogConflictError,
  validateFacultyDepartment,
} from "../db/repositories/facultyDepartmentValidation.js";
import { validateFacultyDesignation } from "../db/repositories/facultyDesignationValidation.js";
import { validateHierarchyDepth } from "../db/repositories/facultyHierarchySql.js";

const tx = { execute: vi.fn() };
const input = {
  id: "a",
  workspaceSubdomain: "tenant",
  facultyId: "f",
  departmentId: "d",
  designationId: "g",
  startDate: "2024-01-01",
};
beforeEach(() => tx.execute.mockReset());

function assignmentQueries() {
  tx.execute
    .mockResolvedValueOnce({ rows: [] }) // tenant lock
    .mockResolvedValueOnce({ rows: [] }) // existing assignment
    .mockResolvedValueOnce({ rows: [{ id: "f" }] })
    .mockResolvedValueOnce({ rows: [{ id: "d" }] })
    .mockResolvedValueOnce({ rows: [{ id: "g" }] });
}

describe("Faculty assignment production validation", () => {
  it("allows faculty-form bootstrap creates", async () => {
    assignmentQueries();
    await expect(validateFacultyAssignment(tx, "tenant", input)).resolves.toBeUndefined();
  });

  it("allows updating an existing appointment", async () => {
    tx.execute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ faculty_id: "f", deleted_at: null }] })
      .mockResolvedValueOnce({ rows: [{ id: "f" }] })
      .mockResolvedValueOnce({ rows: [{ id: "d" }] })
      .mockResolvedValueOnce({ rows: [{ id: "g" }] });
    await expect(validateFacultyAssignment(tx, "tenant", input)).resolves.toBeUndefined();
  });

  it("allows a secondary role without checking primary overlaps", async () => {
    assignmentQueries();
    await expect(
      validateFacultyAssignment(tx, "tenant", { ...input, isPrimary: false }),
    ).resolves.toBeUndefined();
  });

  it("rejects a primary promotion when another period overlaps", async () => {
    assignmentQueries();
    tx.execute.mockResolvedValueOnce({ rows: [{ id: "existing-primary" }] });
    await expect(
      validateFacultyAssignment(tx, "tenant", { ...input, isPrimary: true }),
    ).rejects.toThrow("overlaps");
  });

  it("rejects archived assignments instead of resurrecting them through upsert", async () => {
    tx.execute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ faculty_id: "f", deleted_at: new Date() }] });
    await expect(validateFacultyAssignment(tx, "tenant", input)).rejects.toThrow("archived");
  });

  it("rejects assignments when the department is inactive", async () => {
    tx.execute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "f" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "g" }] });
    await expect(validateFacultyAssignment(tx, "tenant", input)).rejects.toThrow("must be active");
  });
});

describe("Faculty department production validation", () => {
  it("given another live department with the same name (case-insensitive), should raise a catalog conflict", async () => {
    tx.execute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "other" }] });
    await expect(
      validateFacultyDepartment(tx, "tenant", { id: "d", name: "Hadith Sciences" }),
    ).rejects.toBeInstanceOf(FacultyCatalogConflictError);
  });

  it("given an archived department id, should refuse the overwrite", async () => {
    tx.execute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ deleted_at: new Date("2026-01-01") }] });
    await expect(
      validateFacultyDepartment(tx, "tenant", { id: "d", name: "Hadith" }),
    ).rejects.toThrow("archived");
  });

  it("given a parent chain that returns to the designation, should reject the cycle", async () => {
    tx.execute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "dept" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          { id: "child", depth: 1, cycle: false },
          { id: "g", depth: 2, cycle: false },
        ],
      });
    await expect(
      validateFacultyDesignation(tx, "tenant", {
        id: "g",
        departmentId: "dept",
        name: "Lecturer",
        parentDesignationId: "child",
      }),
    ).rejects.toThrow("Circular");
  });

  it("given a live parent two levels deep, should derive rank parent+1", async () => {
    tx.execute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "dept" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          { id: "p", depth: 1, cycle: false },
          { id: "root", depth: 2, cycle: false },
        ],
      });
    const result = await validateFacultyDesignation(tx, "tenant", {
      id: "g",
      departmentId: "dept",
      name: "Lecturer",
      parentDesignationId: "p",
    });
    expect(result).toEqual({ hierarchyRank: 3 });
  });

  it.each([0, -1, 21, NaN, Infinity, 1.1])("rejects unsafe depth %s", (depth) => {
    expect(() => validateHierarchyDepth(depth)).toThrow("Hierarchy depth");
  });
});

describe("Faculty assignment delete guard", () => {
  const onDate = "2026-11-04";

  it("rejects archiving the appointment that currently backs the primary SSOT", () => {
    expect(() =>
      assertFacultyAssignmentDeletable(
        { isPrimary: true, startDate: "2025-01-01", endDate: null, deletedAt: null },
        onDate,
      ),
    ).toThrow(/primary appointment/i);
  });

  it("allows archiving a historical (ended) primary period", () => {
    expect(() =>
      assertFacultyAssignmentDeletable(
        { isPrimary: true, startDate: "2024-01-01", endDate: "2024-12-31", deletedAt: null },
        onDate,
      ),
    ).not.toThrow();
  });

  it("allows archiving a future-dated primary period", () => {
    expect(() =>
      assertFacultyAssignmentDeletable(
        { isPrimary: true, startDate: "2027-01-01", endDate: null, deletedAt: null },
        onDate,
      ),
    ).not.toThrow();
  });

  it("allows archiving a secondary appointment of any period", () => {
    expect(() =>
      assertFacultyAssignmentDeletable(
        { isPrimary: false, startDate: "2025-01-01", endDate: null, deletedAt: null },
        onDate,
      ),
    ).not.toThrow();
  });

  it("is idempotent for an already-archived row", () => {
    expect(() =>
      assertFacultyAssignmentDeletable(
        { isPrimary: true, startDate: "2025-01-01", endDate: null, deletedAt: new Date() },
        onDate,
      ),
    ).not.toThrow();
  });
});
