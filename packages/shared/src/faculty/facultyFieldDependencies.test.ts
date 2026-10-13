import { describe, expect, it } from "vitest";
import { getFacultyFieldRemovalIssues } from "./facultyFieldDependencies.js";

describe("getFacultyFieldRemovalIssues", () => {
  it("blocks deleting seed system fields", () => {
    const issues = getFacultyFieldRemovalIssues({
      fieldKey: "specialization",
      columnRegistry: [],
    });
    expect(issues).toEqual([
      { area: "systemField", messageKey: "faculty.setup.cannotDeleteSystemField" },
    ]);
  });

  it("blocks deleting custom fields still enabled in column registry", () => {
    const issues = getFacultyFieldRemovalIssues({
      fieldKey: "customNotes",
      columnRegistry: [{ key: "custom:customNotes", label: "Notes", enabled: true, order: 0 }],
    });
    expect(issues[0]?.messageKey).toBe("faculty.setup.fieldUsedInColumn");
  });

  it("allows deleting unused custom fields", () => {
    const issues = getFacultyFieldRemovalIssues({
      fieldKey: "customNotes",
      columnRegistry: [{ key: "status", label: "Status", enabled: true, order: 0 }],
    });
    expect(issues).toEqual([]);
  });
});
