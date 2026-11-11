import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Marks import/export runners.
 *
 * The runner closures are captured from `registerBackgroundJobRunner` (the worker's registry) and
 * invoked with a fake job context, so the roll-number resolution, bounds and CSV assembly are
 * exercised without Redis or a database.
 */

type Runner = (payload: unknown, ctx: unknown) => Promise<void>;
const runners = vi.hoisted(() => new Map<string, Runner>());
vi.mock("../services/backgroundJobWorkerService.js", () => ({
  registerBackgroundJobRunner: (key: string, fn: Runner) => runners.set(key, fn),
}));

const findExamById = vi.hoisted(() => vi.fn());
vi.mock("../examinations/repository/examinationsRepositoryAdapter.js", () => ({
  examinationsRepository: { findExamById, listExamResultsPage: vi.fn() },
}));

const loadExamRoster = vi.hoisted(() => vi.fn());
vi.mock("../examinations/repository/examEligibilityAdapter.js", () => ({
  examEligibilityRepository: { loadExamRoster },
}));

const upsertExamResults = vi.hoisted(() =>
  vi.fn(async (_rows: unknown[]): Promise<unknown[]> => []),
);
vi.mock("../examinations/use-cases/examinationsUseCases.js", () => ({
  examinationsUseCases: { upsertExamResults },
}));

const saveExportArtifact = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => undefined));
vi.mock("../services/exportArtifactService.js", () => ({ saveExportArtifact }));

import { registerExaminationsMarksImportJobRunner } from "../services/examinationsMarksImportService.js";
import { registerExaminationsResultsExportJobRunner } from "../services/examinationsResultsExportService.js";

const EXAM = { id: "ex-1", name: "Midterm", totalMarks: 100, date: "2026-03-10" };

function fakeCtx(overrides: Record<string, unknown> = {}) {
  return {
    tenant: "demo",
    userId: "u-teacher",
    jobId: "job-1",
    signal: new AbortController().signal,
    updateProgress: vi.fn(async () => undefined),
    complete: vi.fn(async () => undefined),
    ...overrides,
  };
}

beforeEach(() => {
  runners.clear();
  vi.clearAllMocks();
  findExamById.mockResolvedValue(EXAM);
  loadExamRoster.mockResolvedValue([
    { studentId: "s-1", studentName: "A", rollNumber: "1", classId: "c-1", sectionId: null },
    { studentId: "s-2", studentName: "B", rollNumber: "2", classId: "c-1", sectionId: null },
  ]);
});

describe("examinations:marks-import", () => {
  it("resolves rolls, bounds by the exam total and reports per-row errors", async () => {
    registerExaminationsMarksImportJobRunner();
    const runner = runners.get("examinations:marks-import");
    expect(runner).toBeDefined();
    const ctx = fakeCtx();

    await runner!(
      {
        examId: "ex-1",
        label: "Import",
        rows: [
          { rollNumber: "1", marksObtained: "85" },
          { rollNumber: "2", marksObtained: 150 },
          { rollNumber: "404", marksObtained: 10 },
          { rollNumber: "1", marksObtained: "" },
        ],
      },
      ctx,
    );

    expect(upsertExamResults).toHaveBeenCalledTimes(1);
    const batch = upsertExamResults.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    expect(batch).toHaveLength(1);
    expect(batch[0]).toMatchObject({ examId: "ex-1", studentId: "s-1", marksObtained: 85 });
    expect(ctx.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: expect.arrayContaining([
          expect.objectContaining({ reason: expect.stringContaining("exceed the exam total") }),
          expect.objectContaining({ reason: expect.stringContaining("not enrolled") }),
          expect.objectContaining({ reason: "Marks must be a number" }),
        ]),
      }),
    );
  });
});

describe("examinations:results-export", () => {
  it("writes a formula-safe broadsheet with roster names", async () => {
    registerExaminationsResultsExportJobRunner();
    const runner = runners.get("examinations:results-export");
    const listExamResultsPage = (
      await import("../examinations/repository/examinationsRepositoryAdapter.js")
    ).examinationsRepository.listExamResultsPage as unknown as ReturnType<typeof vi.fn>;
    listExamResultsPage.mockResolvedValue({
      results: [
        { id: "r-1", examId: "ex-1", studentId: "s-1", marksObtained: 90, graceMarks: 0 },
        { id: "r-2", examId: "ex-1", studentId: "s-2", marksObtained: 40, graceMarks: 2 },
      ],
      hasMore: false,
    });
    const ctx = fakeCtx();

    await runner!({ examId: "ex-1", label: "Export" }, ctx);

    const csv = String(saveExportArtifact.mock.calls[0]?.[2]);
    expect(csv).toContain("Roll Number");
    expect(csv).toContain("Midterm");
    expect(csv).toContain("90");
    expect(ctx.complete).toHaveBeenCalledWith(expect.objectContaining({ hasDownload: true }));
  });
});
