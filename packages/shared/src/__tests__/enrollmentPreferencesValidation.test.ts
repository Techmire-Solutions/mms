import { describe, expect, it } from "vitest";
import { DEFAULT_ENROLLMENTS_SETTINGS, validateEnrollmentPreferences } from "../index.js";

const valid = {
  maxStudentsPerClass: DEFAULT_ENROLLMENTS_SETTINGS.maxStudentsPerClass,
  waitlistEnabled: true,
  waitlistOfferHours: DEFAULT_ENROLLMENTS_SETTINGS.waitlistOfferHours,
  requireEligibilityCheck: true,
  autoAssignClass: false,
  enrollmentApproval: true,
  allowTransfers: true,
  dropDeadlineDays: DEFAULT_ENROLLMENTS_SETTINGS.dropDeadlineDays,
  reenrollmentReminder: true,
  defaultViewLayout: "list",
};

describe("validateEnrollmentPreferences", () => {
  it("accepts the defaults", () => {
    expect(validateEnrollmentPreferences(valid)).toEqual([]);
  });

  it("rejects non-integers, out-of-range values and missing numbers", () => {
    expect(validateEnrollmentPreferences({ ...valid, maxStudentsPerClass: "0" })).toContainEqual({
      field: "maxStudentsPerClass",
      code: "range",
    });
    expect(validateEnrollmentPreferences({ ...valid, dropDeadlineDays: "14d" })).toContainEqual({
      field: "dropDeadlineDays",
      code: "integer",
    });
    expect(validateEnrollmentPreferences({ ...valid, waitlistOfferHours: "721" })).toContainEqual({
      field: "waitlistOfferHours",
      code: "range",
    });
    expect(
      validateEnrollmentPreferences({ ...valid, waitlistOfferHours: " " }).map((i) => i.field),
    ).toContain("waitlistOfferHours");
  });
});
