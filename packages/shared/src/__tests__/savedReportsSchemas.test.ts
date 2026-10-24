import { describe, expect, it } from "vitest";
import {
  genericSavedReportCreateSchema,
  genericSavedReportListQuerySchema,
} from "../reports/savedReportsSchemas.js";

describe("generic saved-report schemas", () => {
  it("accepts a supported category and non-empty name", () => {
    expect(
      genericSavedReportCreateSchema.safeParse({
        name: "Attendance exceptions",
        category: "attendance",
        filters: { status: "absent" },
      }).success,
    ).toBe(true);
  });

  it("rejects unsupported categories", () => {
    expect(genericSavedReportListQuerySchema.safeParse({ category: "contacts" }).success).toBe(
      false,
    );
    expect(
      genericSavedReportCreateSchema.safeParse({
        name: "Contact report",
        category: "contacts",
        filters: {},
      }).success,
    ).toBe(false);
  });

  it("rejects empty and overlong names", () => {
    expect(
      genericSavedReportCreateSchema.safeParse({
        name: "   ",
        category: "students",
        filters: {},
      }).success,
    ).toBe(false);
    expect(
      genericSavedReportCreateSchema.safeParse({
        name: "x".repeat(201),
        category: "students",
        filters: {},
      }).success,
    ).toBe(false);
  });
});
