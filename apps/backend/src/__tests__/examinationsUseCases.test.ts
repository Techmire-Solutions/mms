import { describe, expect, it, vi } from "vitest";
import { createExaminationsUseCases } from "../examinations/use-cases/examinationsUseCases.js";
import type { ExaminationsRepository } from "../examinations/repository/examinationsRepository.js";
import { runWithTenant } from "../lib/tenantContext.js";

function createFakeRepo(): ExaminationsRepository {
  return {
    listExamsByWorkspace: vi.fn().mockResolvedValue([]),
    findExamById: vi.fn().mockResolvedValue(null),
    findExamsByIds: vi.fn().mockResolvedValue([]),
    saveExam: vi.fn().mockResolvedValue(undefined),
    bulkSaveExams: vi.fn().mockResolvedValue(undefined),
    replaceExamsForWorkspace: vi.fn().mockResolvedValue(undefined),
    listExamsPage: vi.fn().mockResolvedValue({
      exams: [],
      total: 0,
      page: 1,
      limit: 12,
      hasMore: false,
    }),
    listExamResultsByWorkspace: vi.fn().mockResolvedValue([]),
    findExamResultById: vi.fn().mockResolvedValue(null),
    findExamResultsByIds: vi.fn().mockResolvedValue([]),
    saveExamResult: vi.fn().mockResolvedValue(undefined),
    bulkSaveExamResults: vi.fn().mockResolvedValue(undefined),
    replaceExamResultsForWorkspace: vi.fn().mockResolvedValue(undefined),
    aggregateExaminationsCommandMetrics: vi.fn().mockResolvedValue({
      total: 3,
      upcoming: 1,
      ongoing: 1,
      completed: 1,
      scheduled: 0,
      cancelled: 0,
      totalResults: 2,
      examsWithResults: 1,
      passRate: 80,
    }),
    aggregateExaminationsWidgetQueries: vi.fn().mockResolvedValue({}),
    loadExaminationsReportAggregates: vi.fn().mockResolvedValue({}),
  };
}

describe("examinations use-cases (DI with fake repository)", () => {
  it("loadExamsPage delegates to the injected repository with the active tenant", async () => {
    const repo = createFakeRepo();
    const useCases = createExaminationsUseCases(repo);

    const result = await runWithTenant("demo", () =>
      useCases.loadExamsPage({ page: 2, limit: 12 }),
    );

    expect(result).toEqual({ exams: [], total: 0, page: 1, limit: 12, hasMore: false });
    expect(repo.listExamsPage).toHaveBeenCalledWith("demo", { page: 2, limit: 12 });
  });

  it("loadExaminationsCommandMetrics delegates to the injected repository", async () => {
    const repo = createFakeRepo();
    const useCases = createExaminationsUseCases(repo);

    const result = await runWithTenant("demo", () => useCases.loadExaminationsCommandMetrics());

    expect(result.total).toBe(3);
    expect(repo.aggregateExaminationsCommandMetrics).toHaveBeenCalledWith("demo");
  });

  it("returns empty defaults when no tenant context is bound", async () => {
    const repo = createFakeRepo();
    const useCases = createExaminationsUseCases(repo);

    const page = await useCases.loadExamsPage({ page: 1, limit: 12 });
    const metrics = await useCases.loadExaminationsCommandMetrics();

    expect(page).toEqual({ exams: [], total: 0, page: 1, limit: 12, hasMore: false });
    expect(metrics.total).toBe(0);
    expect(repo.listExamsPage).not.toHaveBeenCalled();
    expect(repo.aggregateExaminationsCommandMetrics).not.toHaveBeenCalled();
  });

  it("loadExamById and loadExamsByIds delegate with soft-delete filtering", async () => {
    const activeExam = {
      id: "ex_1",
      name: "Midterm",
      subject: "Math",
      totalMarks: 100,
      passingMarks: 50,
      date: "2026-05-15",
      duration: 90,
      classIds: ["c1"],
      status: "upcoming" as const,
      description: "",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const deletedExam = {
      ...activeExam,
      id: "ex_2",
      deletedAt: "2026-01-02T00:00:00.000Z",
    };

    const repo = createFakeRepo();
    vi.mocked(repo.findExamById).mockResolvedValue(deletedExam);
    vi.mocked(repo.findExamsByIds).mockImplementation(async (_tenant, ids, opts) => {
      const all = [activeExam, deletedExam].filter((e) => ids.includes(e.id));
      if (opts?.includeDeleted) return all.filter((e) => Boolean((e as any).deletedAt));
      return all.filter((e) => !(e as any).deletedAt);
    });
    const useCases = createExaminationsUseCases(repo);

    await runWithTenant("demo", async () => {
      // Excludes deleted by default
      const res1 = await useCases.loadExamById("ex_2");
      expect(res1).toBeNull();

      // Includes deleted when requested
      const res2 = await useCases.loadExamById("ex_2", true);
      expect(res2?.id).toBe("ex_2");

      // Batch lookups with deduplication and filtering
      const batchRes = await useCases.loadExamsByIds(["ex_1", "ex_2", "ex_1 "]);
      expect(batchRes).toHaveLength(1);
      expect(batchRes[0]?.id).toBe("ex_1");

      // Soft-deleted rows for trash
      const batchArchived = await useCases.loadExamsByIds(["ex_1", "ex_2"], true);
      expect(batchArchived).toHaveLength(1);
      expect(batchArchived[0]?.id).toBe("ex_2");
    });
  });

  it("loadExamResultById and loadExamResultsByIds delegate to repository with clean IDs", async () => {
    const result1 = {
      id: "res_1",
      examId: "ex_1",
      studentId: "st_1",
      marksObtained: 85,
    };

    const repo = createFakeRepo();
    vi.mocked(repo.findExamResultById).mockResolvedValue(result1);
    vi.mocked(repo.findExamResultsByIds).mockResolvedValue([result1]);
    const useCases = createExaminationsUseCases(repo);

    await runWithTenant("demo", async () => {
      const res = await useCases.loadExamResultById("res_1");
      expect(res).toEqual(result1);
      expect(repo.findExamResultById).toHaveBeenCalledWith("demo", "res_1");

      const batch = await useCases.loadExamResultsByIds(["res_1", " res_1 "]);
      expect(batch).toEqual([result1]);
      expect(repo.findExamResultsByIds).toHaveBeenCalledWith("demo", ["res_1"]);
    });
  });
});
