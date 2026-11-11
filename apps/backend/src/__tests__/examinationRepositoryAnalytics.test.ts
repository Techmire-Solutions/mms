import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.hoisted(() => vi.fn());
vi.mock("../db/tenant-context.js", () => ({
  withTenantRead: async (_tenant: string, fn: (tx: unknown) => Promise<unknown>) => fn({ execute }),
}));
vi.mock("../db/documentStoreKeys.js", () => ({
  getQueryRows: (result: { rows: unknown[] }) => result.rows,
}));

import { loadExaminationsAnalytics } from "../db/repositories/examinationRepositoryAnalytics.js";

describe("loadExaminationsAnalytics", () => {
  beforeEach(() => {
    execute.mockReset();
  });

  it("computes all four aggregates in one tenant-scoped statement", async () => {
    execute.mockResolvedValue({
      rows: [
        { kind: "subject", name: "Quran", total: 10, passed: 8 },
        { kind: "grade", name: "A+", total: 3 },
        { kind: "grade", name: "F", total: 2 },
        { kind: "top", name: "s-1", total: 4, metric: "91.25" },
        { kind: "section", name: "Class 5", total: 10, metric: "78.5" },
      ],
    });

    const result = await loadExaminationsAnalytics("demo", { publishedOnly: true });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(result.subjectPassRates).toEqual([
      { subject: "Quran", total: 10, passed: 8, passRatePct: 80 },
    ]);
    expect(result.gradeDistribution.find((band) => band.grade === "A+")?.count).toBe(3);
    expect(result.gradeDistribution.find((band) => band.grade === "F")?.count).toBe(2);
    expect(result.topPerformers).toEqual([{ studentId: "s-1", averagePct: 91.25, exams: 4 }]);
    expect(result.sectionAverages).toEqual([{ label: "Class 5", total: 10, averagePct: 78.5 }]);
  });

  it("returns empty aggregates when marks exist", async () => {
    execute.mockResolvedValue({ rows: [] });
    const result = await loadExaminationsAnalytics("demo");
    expect(result.subjectPassRates).toEqual([]);
    expect(result.topPerformers).toEqual([]);
    expect(result.sectionAverages).toEqual([]);
    expect(result.gradeDistribution.every((band) => band.count === 0)).toBe(true);
  });

  it("skips the query entirely without a tenant", async () => {
    const result = await loadExaminationsAnalytics("  ");
    expect(execute).not.toHaveBeenCalled();
    expect(result.subjectPassRates).toEqual([]);
  });
});
