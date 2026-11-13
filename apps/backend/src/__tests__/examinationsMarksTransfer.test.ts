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
const findExamResultVersionsByExam = vi.hoisted(() => vi.fn());
vi.mock("../examinations/repository/examinationsRepositoryAdapter.js", () => ({
  examinationsRepository: {
    findExamById,
    findExamResultVersionsByExam,
    listExamResultsPage: vi.fn(),
  },
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

const assertExamResultsEligible = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("../examinations/use-cases/examEligibilityGate.js", () => ({
  assertExamResultsEligible,
}));

const saveExportArtifact = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => undefined));
const saveStreamedExportArtifact = vi.hoisted(() =>
  vi.fn(async (..._args: unknown[]) => undefined),
);
vi.mock("../services/exportArtifactService.js", () => ({
  saveExportArtifact,
  saveStreamedExportArtifact,
}));

/** Captures the streamed broadsheet instead of writing to disk. */
const uploads = vi.hoisted(() => [] as Array<{ key: string; content: string }>);
vi.mock("../config/storage.js", () => ({
  resolveTenantExportKey: (_tenant: string, filename: string) => `tenants/demo/exports/${filename}`,
  uploadStreamToStorage: async (_tenant: string, key: string, stream: NodeJS.ReadableStream) => {
    let content = "";
    try {
      for await (const chunk of stream) content += String(chunk);
    } catch {
      // A destroyed stream means the job failed; the runner rethrows.
    }
    uploads.push({ key, content });
    return { key, storageType: "local" as const };
  },
}));

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
  uploads.length = 0;
  findExamById.mockResolvedValue(EXAM);
  findExamResultVersionsByExam.mockResolvedValue([]);
  assertExamResultsEligible.mockReset();
  assertExamResultsEligible.mockResolvedValue(undefined);
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

  it("echoes the stored id and OCC version for marks it replaces", async () => {
    findExamResultVersionsByExam.mockResolvedValue([
      { studentId: "s-1", id: "er-stored", version: 4 },
    ]);
    registerExaminationsMarksImportJobRunner();
    const runner = runners.get("examinations:marks-import");

    await runner!(
      {
        examId: "ex-1",
        rows: [
          { rollNumber: "1", marksObtained: 85 },
          { rollNumber: "2", marksObtained: 70 },
        ],
      },
      fakeCtx(),
    );

    const batch = upsertExamResults.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    // The concurrent-edit guard only works if the importer sends the token the grid would send.
    expect(batch.find((row) => row.studentId === "s-1")).toMatchObject({
      id: "er-stored",
      version: 4,
    });
    const newMark = batch.find((row) => row.studentId === "s-2");
    expect(newMark).toBeDefined();
    expect(newMark).not.toHaveProperty("version");
  });

  it("runs the eligibility gate for the chunk and again for every fallback row", async () => {
    // Chunk rejected, first row rejected, second row allowed: the fallback must re-gate each row or
    // a blocked student would slip through the row-by-row retry.
    assertExamResultsEligible
      .mockRejectedValueOnce(new Error("Below the exam attendance threshold"))
      .mockRejectedValueOnce(new Error("Below the exam attendance threshold"));

    registerExaminationsMarksImportJobRunner();
    const runner = runners.get("examinations:marks-import");
    const ctx = fakeCtx();

    await runner!(
      {
        examId: "ex-1",
        rows: [
          { rollNumber: "1", marksObtained: 85 },
          { rollNumber: "2", marksObtained: 70 },
        ],
      },
      ctx,
    );

    expect(assertExamResultsEligible).toHaveBeenCalledTimes(3);
    expect(upsertExamResults).toHaveBeenCalledTimes(1);
    expect(ctx.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: expect.arrayContaining([
          expect.objectContaining({
            reason: expect.stringContaining("attendance threshold"),
          }),
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

    await runner!({ examId: "ex-1", label: "Export", includeInternal: true }, ctx);

    const csv = uploads.at(-1)?.content ?? "";
    expect(csv).toContain("Roll Number");
    expect(csv).toContain("Midterm");
    expect(csv).toContain("90");
    expect(csv).toContain("Grace Marks");
    expect(ctx.complete).toHaveBeenCalledWith(expect.objectContaining({ hasDownload: true }));
  });

  it("exports only published marks and omits the moderation column for a non-grader", async () => {
    registerExaminationsResultsExportJobRunner();
    const runner = runners.get("examinations:results-export");
    const repo = (await import("../examinations/repository/examinationsRepositoryAdapter.js"))
      .examinationsRepository;
    findExamById.mockResolvedValue({ ...EXAM, resultsFinalizedAt: "2026-03-11T00:00:00.000Z" });
    const listExamResultsPage = repo.listExamResultsPage as unknown as ReturnType<typeof vi.fn>;
    listExamResultsPage.mockResolvedValue({
      results: [{ id: "r-1", examId: "ex-1", studentId: "s-1", marksObtained: 90, graceMarks: 2 }],
      hasMore: false,
    });
    const ctx = fakeCtx();

    // Older queued jobs carry no flag: the safe published-only mode applies.
    await runner!({ examId: "ex-1", label: "Export" }, ctx);

    expect(listExamResultsPage).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({ publishedOnly: true }),
    );
    const csv = uploads.at(-1)?.content ?? "";
    expect(csv).not.toContain("Grace Marks");
    expect(ctx.complete).toHaveBeenCalledWith(expect.objectContaining({ hasDownload: true }));
  });

  it("refuses a non-grader export of an unpublished exam (job replay guard)", async () => {
    registerExaminationsResultsExportJobRunner();
    const runner = runners.get("examinations:results-export");
    findExamById.mockResolvedValue({ ...EXAM, resultsFinalizedAt: null });

    await expect(runner!({ examId: "ex-1" }, fakeCtx())).rejects.toThrow("Exam not found");
    expect(uploads).toHaveLength(0);
    expect(saveStreamedExportArtifact).not.toHaveBeenCalled();
  });

  it("neutralises formula-leading student names and roll numbers in the streamed broadsheet", async () => {
    registerExaminationsResultsExportJobRunner();
    const runner = runners.get("examinations:results-export");
    loadExamRoster.mockResolvedValue([
      {
        studentId: "s-1",
        rollNumber: "+1",
        studentName: '=HYPERLINK("http://evil.test")',
      },
    ]);
    const repo = (await import("../examinations/repository/examinationsRepositoryAdapter.js"))
      .examinationsRepository;
    (repo.listExamResultsPage as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      results: [{ id: "r-1", examId: "ex-1", studentId: "s-1", marksObtained: 90 }],
      hasMore: false,
    });
    findExamById.mockResolvedValue({ ...EXAM, resultsFinalizedAt: "2026-03-11T00:00:00.000Z" });

    await runner!({ examId: "ex-1", label: "Export", includeInternal: true }, fakeCtx());

    const csv = uploads.at(-1)?.content ?? "";
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'+1");
    expect(csv).not.toContain(",=HYPERLINK");
  });

  it("streams a page at a time until the marks run out", async () => {
    registerExaminationsResultsExportJobRunner();
    const runner = runners.get("examinations:results-export");
    const repo = (await import("../examinations/repository/examinationsRepositoryAdapter.js"))
      .examinationsRepository;
    const listPage = repo.listExamResultsPage as unknown as ReturnType<typeof vi.fn>;
    listPage
      .mockResolvedValueOnce({
        results: [{ id: "r-1", examId: "ex-1", studentId: "s-1", marksObtained: 90 }],
        hasMore: true,
      })
      .mockResolvedValueOnce({
        results: [{ id: "r-2", examId: "ex-1", studentId: "s-2", marksObtained: 80 }],
        hasMore: false,
      });
    findExamById.mockResolvedValue({ ...EXAM, resultsFinalizedAt: "2026-03-11T00:00:00.000Z" });

    await runner!({ examId: "ex-1", includeInternal: true }, fakeCtx());

    expect(listPage).toHaveBeenCalledTimes(2);
    expect(listPage.mock.calls[1]?.[1]).toMatchObject({ cursor: "r-1" });
    const csv = uploads.at(-1)?.content ?? "";
    expect(csv).toContain("90");
    expect(csv).toContain("80");
  });

  it("stops a streamed export when the job is aborted", async () => {
    registerExaminationsResultsExportJobRunner();
    const runner = runners.get("examinations:results-export");
    findExamById.mockResolvedValue({ ...EXAM, resultsFinalizedAt: "2026-03-11T00:00:00.000Z" });
    const controller = new AbortController();
    controller.abort();

    await expect(
      runner!({ examId: "ex-1", includeInternal: true }, fakeCtx({ signal: controller.signal })),
    ).rejects.toThrow(/abort/i);
    expect(saveStreamedExportArtifact).not.toHaveBeenCalled();
  });
});
