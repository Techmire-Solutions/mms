import { describe, expect, it } from "vitest";
import { STUDENT_SORT_FIELDS, STUDENT_SORT_FIELD_SET } from "./studentDirectoryColumns.js";

describe("STUDENT_SORT_FIELDS", () => {
  it("is the single allowlist for both server and client sorting", () => {
    expect(STUDENT_SORT_FIELDS).toContain("studentId");
    expect(STUDENT_SORT_FIELDS).toContain("updatedAt");
    expect(STUDENT_SORT_FIELD_SET.has("studentId")).toBe(true);
    expect(STUDENT_SORT_FIELD_SET.size).toBe(STUDENT_SORT_FIELDS.length);
  });
});
