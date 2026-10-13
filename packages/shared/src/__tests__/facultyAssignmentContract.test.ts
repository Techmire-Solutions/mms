import { describe, expect, it } from "vitest";
import {
  facultyAssignmentWriteSchema,
  facultyDepartmentWriteSchema,
} from "../faculty/facultyDepartmentTypes.js";

const assignment = {
  facultyId: "f",
  departmentId: "d",
  designationId: "g",
  startDate: "2024-02-29",
};

describe("Faculty assignment write contract", () => {
  it("accepts leap days and defaults secondary appointments", () => {
    const parsed = facultyAssignmentWriteSchema.parse(assignment);
    expect(parsed.isPrimary).toBe(false);
    expect(parsed.status).toBe("active");
  });
  it("accepts inactive assignment status", () => {
    expect(facultyAssignmentWriteSchema.parse({ ...assignment, status: "inactive" }).status).toBe(
      "inactive",
    );
  });
  it.each(["2023-02-29", "2024-02-30", "2024-13-01"])("rejects impossible date %s", (startDate) => {
    expect(facultyAssignmentWriteSchema.safeParse({ ...assignment, startDate }).success).toBe(
      false,
    );
  });
  it("rejects reversed date ranges and injected tenant/deletion fields", () => {
    expect(
      facultyAssignmentWriteSchema.safeParse({ ...assignment, endDate: "2024-02-28" }).success,
    ).toBe(false);
    expect(
      facultyAssignmentWriteSchema.safeParse({ ...assignment, workspaceSubdomain: "other" })
        .success,
    ).toBe(false);
    expect(facultyAssignmentWriteSchema.safeParse({ ...assignment, deletedAt: null }).success).toBe(
      false,
    );
  });
  it("rejects department fields outside the write contract", () => {
    expect(
      facultyDepartmentWriteSchema.safeParse({ name: "Department", code: "D", deletedAt: null })
        .success,
    ).toBe(false);
  });
});
