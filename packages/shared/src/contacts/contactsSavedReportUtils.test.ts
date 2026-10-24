import { describe, expect, it } from "vitest";
import type { ContactsSavedReport } from "./contactsPreferencesTypes.js";
import {
  canDeleteContactsSavedReport,
  canViewContactsSavedReport,
  validateContactsSavedReportDrillDown,
  type ContactsSavedReportViewer,
} from "./contactsSavedReportUtils.js";

function report(overrides: Partial<ContactsSavedReport> = {}): ContactsSavedReport {
  return {
    id: "r1",
    name: "Males",
    drillDown: { gender: "male" },
    createdBy: "u-admin",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function viewer(overrides: Partial<ContactsSavedReportViewer> = {}): ContactsSavedReportViewer {
  return { id: "u-other", role: "teacher", ...overrides };
}

describe("canViewContactsSavedReport", () => {
  it("returns true for global scope regardless of viewer", () => {
    expect(canViewContactsSavedReport(report({ shareScope: "global" }), viewer())).toBe(true);
  });

  it("returns true for the report owner", () => {
    const owner = viewer({ id: "u-admin" });
    expect(canViewContactsSavedReport(report(), owner)).toBe(true);
  });

  it("returns true for admins", () => {
    expect(canViewContactsSavedReport(report(), viewer({ isAdmin: true }))).toBe(true);
  });

  it("denies private reports to non-owners", () => {
    expect(canViewContactsSavedReport(report({ shareScope: "private" }), viewer())).toBe(false);
  });

  it("grants roles scope only to shared roles", () => {
    const shared = report({ shareScope: "roles", sharedWithRoles: ["teacher"] });
    expect(canViewContactsSavedReport(shared, viewer({ role: "teacher" }))).toBe(true);
    expect(canViewContactsSavedReport(shared, viewer({ role: "accountant" }))).toBe(false);
  });

  it("grants users scope only to shared user ids", () => {
    const shared = report({ shareScope: "users", sharedWithUserIds: ["u-a"] });
    expect(canViewContactsSavedReport(shared, viewer({ id: "u-a" }))).toBe(true);
    expect(canViewContactsSavedReport(shared, viewer({ id: "u-b" }))).toBe(false);
  });

  it("defaults to private when shareScope is omitted", () => {
    expect(canViewContactsSavedReport(report(), viewer())).toBe(false);
  });
});

describe("canDeleteContactsSavedReport", () => {
  it("allows the owner and admins", () => {
    expect(canDeleteContactsSavedReport(report(), viewer({ id: "u-admin" }))).toBe(true);
    expect(canDeleteContactsSavedReport(report(), viewer({ isAdmin: true }))).toBe(true);
  });

  it("denies other viewers", () => {
    expect(canDeleteContactsSavedReport(report(), viewer())).toBe(false);
  });
});

describe("validateContactsSavedReportDrillDown", () => {
  it("flags a gender that is no longer in Setup", () => {
    const issues = validateContactsSavedReportDrillDown(
      { gender: "alien" },
      { genders: ["male", "female"] },
    );
    expect(issues).toEqual([{ kind: "stale_gender", field: "gender", value: "alien" }]);
  });

  it("flags a quick filter that is not a known preset", () => {
    const issues = validateContactsSavedReportDrillDown({ quickFilter: "vip" }, {});
    expect(issues).toEqual([{ kind: "stale_quick_filter", field: "quickFilter", value: "vip" }]);
  });

  it("returns no issues when values are valid", () => {
    expect(
      validateContactsSavedReportDrillDown(
        { gender: "male", quickFilter: "whatsapp" },
        { genders: ["male", "female"] },
      ),
    ).toEqual([]);
  });

  it("skips gender when Setup provides no genders list", () => {
    expect(validateContactsSavedReportDrillDown({ gender: "alien" }, { genders: [] })).toEqual([]);
  });

  it("returns no issues for an empty drill-down", () => {
    expect(validateContactsSavedReportDrillDown({}, { genders: ["male"] })).toEqual([]);
  });
});
