import { describe, expect, it } from "vitest";
import { DEFAULT_STUDENT_EXPORT_COLUMNS, studentColumnLabelKey } from "./studentsExportUtils.js";

describe("DEFAULT_STUDENT_EXPORT_COLUMNS", () => {
  it("ships the identity + status + parent columns in export order", () => {
    expect(DEFAULT_STUDENT_EXPORT_COLUMNS.map((column) => column.id)).toEqual([
      "name",
      "grNumber",
      "gender",
      "phone",
      "email",
      "dob",
      "parents",
      "status",
      "registeredDate",
      "notes",
    ]);
  });

  it("carries English fallback labels", () => {
    expect(DEFAULT_STUDENT_EXPORT_COLUMNS[0]?.label).toBe("Name");
    expect(DEFAULT_STUDENT_EXPORT_COLUMNS.find((column) => column.id === "parents")?.label).toBe(
      "Parents",
    );
  });
});

describe("studentColumnLabelKey", () => {
  it("maps column keys to students.columns translation keys", () => {
    expect(studentColumnLabelKey("name")).toBe("students.columns.name");
    expect(studentColumnLabelKey("grNumber")).toBe("students.columns.grNumber");
    expect(studentColumnLabelKey("status")).toBe("students.columns.status");
    expect(studentColumnLabelKey("parents")).toBe("students.columns.parents");
  });
});
