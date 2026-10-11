import { describe, expect, it } from "vitest";
import {
  isLegacyLocalSavedReport,
  planLegacySavedReportsMigration,
  removeMigratedLocalReports,
  reportsEquivalentByNameAndFilters,
  stableSerialize,
  type LegacyLocalSavedReport,
} from "@/lib/reports/legacySavedReportsMigration";

function legacyReport(
  overrides: Partial<LegacyLocalSavedReport> &
    Pick<LegacyLocalSavedReport, "id" | "name" | "category">,
): LegacyLocalSavedReport {
  return {
    filters: {},
    lastRun: "2026-01-01",
    createdBy: "local-user",
    ...overrides,
  };
}

describe("stableSerialize", () => {
  it("treats key-order differences as equal", () => {
    expect(stableSerialize({ b: 1, a: { d: 2, c: 3 } })).toBe(
      stableSerialize({ a: { c: 3, d: 2 }, b: 1 }),
    );
  });
});

describe("reportsEquivalentByNameAndFilters", () => {
  it("matches same name with reordered filters", () => {
    expect(
      reportsEquivalentByNameAndFilters(
        { name: "Active", filters: { status: "active", session: "all" } },
        { name: "Active", filters: { session: "all", status: "active" } },
      ),
    ).toBe(true);
  });

  it("rejects different filters under the same name", () => {
    expect(
      reportsEquivalentByNameAndFilters(
        { name: "Active", filters: { status: "active" } },
        { name: "Active", filters: { status: "inactive" } },
      ),
    ).toBe(false);
  });
});

describe("planLegacySavedReportsMigration", () => {
  it("dedups same-name same-filter against server and skips import", () => {
    const local = [
      legacyReport({
        id: "local-1",
        name: "Active",
        category: "students",
        filters: { status: "active", session: "all" },
      }),
    ];
    const plan = planLegacySavedReportsMigration({
      category: "students",
      localReports: local,
      serverReports: [{ name: "Active", filters: { session: "all", status: "active" } }],
    });

    expect(plan.toImport).toEqual([]);
    expect(plan.categoryIdsToRemove).toEqual(["local-1"]);
    expect(plan.retainedLocalReports).toEqual([]);
  });

  it("imports same name when filters differ", () => {
    const local = [
      legacyReport({
        id: "local-2",
        name: "Active",
        category: "students",
        filters: { status: "inactive" },
      }),
    ];
    const plan = planLegacySavedReportsMigration({
      category: "students",
      localReports: local,
      serverReports: [{ name: "Active", filters: { status: "active" } }],
    });

    expect(plan.toImport).toEqual([
      { id: "local-2", name: "Active", filters: { status: "inactive" } },
    ]);
    expect(plan.categoryIdsToRemove).toEqual(["local-2"]);
  });

  it("isolates categories — other categories remain retained", () => {
    const local = [
      legacyReport({
        id: "stu-1",
        name: "Students A",
        category: "students",
        filters: { status: "active" },
      }),
      legacyReport({
        id: "fac-1",
        name: "Faculty A",
        category: "faculty",
        filters: { status: "active" },
      }),
    ];
    const plan = planLegacySavedReportsMigration({
      category: "students",
      localReports: local,
      serverReports: [],
    });

    expect(plan.toImport).toEqual([
      { id: "stu-1", name: "Students A", filters: { status: "active" } },
    ]);
    expect(plan.categoryIdsToRemove).toEqual(["stu-1"]);
    expect(plan.retainedLocalReports).toEqual([local[1]]);
  });

  it("retains invalid records and does not import them", () => {
    const invalid = { id: "bad", name: 12, category: "students" };
    const local = [
      invalid,
      legacyReport({
        id: "ok-1",
        name: "Ok",
        category: "students",
        filters: { status: "active" },
      }),
    ];
    const plan = planLegacySavedReportsMigration({
      category: "students",
      localReports: local,
      serverReports: [],
    });

    expect(isLegacyLocalSavedReport(invalid)).toBe(false);
    expect(plan.toImport).toHaveLength(1);
    expect(plan.toImport[0]?.id).toBe("ok-1");
    expect(plan.retainedLocalReports).toEqual([invalid]);
  });

  it("dedups duplicate local presets within the same category", () => {
    const local = [
      legacyReport({
        id: "a",
        name: "Dup",
        category: "attendance",
        filters: { b: 1, a: 2 },
      }),
      legacyReport({
        id: "b",
        name: "Dup",
        category: "attendance",
        filters: { a: 2, b: 1 },
      }),
    ];
    const plan = planLegacySavedReportsMigration({
      category: "attendance",
      localReports: local,
      serverReports: [],
    });

    expect(plan.toImport).toHaveLength(1);
    expect(plan.categoryIdsToRemove).toEqual(["a", "b"]);
  });
});

describe("removeMigratedLocalReports", () => {
  it("removes only migrated category ids and keeps invalid + other categories", () => {
    const students = legacyReport({
      id: "stu-1",
      name: "Students",
      category: "students",
      filters: {},
    });
    const faculty = legacyReport({
      id: "fac-1",
      name: "Faculty",
      category: "faculty",
      filters: {},
    });
    const invalid = { broken: true };
    const remaining = removeMigratedLocalReports([students, faculty, invalid], ["stu-1"]);

    expect(remaining).toEqual([faculty, invalid]);
  });
});
