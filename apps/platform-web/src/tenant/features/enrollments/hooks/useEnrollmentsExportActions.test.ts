import { describe, expect, it } from "vitest";
import { defaultEnrollmentsExportColumns } from "./useEnrollmentsExportActions";

describe("useEnrollmentsExportActions utilities", () => {
  it("generates default export columns correctly covering all tabs", () => {
    const columns = defaultEnrollmentsExportColumns((key) => key);
    expect(columns.length).toBeGreaterThanOrEqual(16);
    expect(columns[0]).toEqual({
      id: "studentName",
      label: "enrollments.columns.student",
    });
    const ids = columns.map((c) => c.id);
    expect(ids).toContain("studentId");
    expect(ids).toContain("sessionId");
    expect(ids).toContain("baseFee");
    expect(ids).toContain("discountType");
    expect(ids).toContain("notes");
  });

  it("merges custom columns into default export columns", () => {
    const custom = [{ id: "customRemark", label: "Special Remark" }];
    const columns = defaultEnrollmentsExportColumns((key) => key, custom);
    expect(columns.some((c) => c.id === "customRemark")).toBe(true);
  });
});
