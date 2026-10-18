import { describe, expect, it } from "vitest";
import { getStudentFieldRemovalIssues } from "./studentFieldDependencies.js";

describe("getStudentFieldRemovalIssues", () => {
  it("blocks deleting seed/system fields", () => {
    const issues = getStudentFieldRemovalIssues({
      fieldKey: "dob",
      columnRegistry: [],
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.messageKey).toBe("students.setup.cannotDeleteSystemField");
  });

  it("blocks deleting when custom column is enabled", () => {
    const issues = getStudentFieldRemovalIssues({
      fieldKey: "scholarship",
      columnRegistry: [
        { key: "custom:scholarship", label: "Scholarship", enabled: true, order: 10 },
      ],
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.messageKey).toBe("students.setup.fieldUsedInColumn");
  });

  it("allows deleting custom fields with no enabled column", () => {
    const issues = getStudentFieldRemovalIssues({
      fieldKey: "scholarship",
      columnRegistry: [
        { key: "custom:scholarship", label: "Scholarship", enabled: false, order: 10 },
      ],
    });
    expect(issues).toHaveLength(0);
  });
});
