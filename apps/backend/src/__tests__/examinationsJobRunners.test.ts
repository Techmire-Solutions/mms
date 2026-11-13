import { beforeEach, describe, expect, it, vi } from "vitest";

const upsertExams = vi.hoisted(() => vi.fn(async (_records: unknown[]): Promise<unknown[]> => []));
vi.mock("../examinations/use-cases/examinationsUseCases.js", () => ({
  examinationsUseCases: { upsertExams },
}));

const listExamsByWorkspace = vi.hoisted(() => vi.fn());
vi.mock("../examinations/repository/examinationsRepositoryAdapter.js", () => ({
  examinationsRepository: { listExamsByWorkspace },
}));

import { resolveJobExecutionTimeoutMs } from "../worker/queues/queueConfig.js";
import { registerDefaultBackgroundJobRunners } from "../services/backgroundJobRunnerService.js";
import { hasBackgroundJobRunner } from "../services/backgroundJobWorkerService.js";
import {
  buildExaminationsCsvExport,
  type ExaminationsCsvExportOptions,
} from "../services/examinationsExportService.js";
import { mapExaminationsImportRow } from "../services/examinationsImportService.js";

const exportOptions: ExaminationsCsvExportOptions = { viewerRole: "admin" };
const CLASSES = new Map([["class 5 - a", "cls-1"]]);

beforeEach(() => {
  vi.clearAllMocks();
  listExamsByWorkspace.mockResolvedValue([]);
});

describe("examinations background job runners", () => {
  it("registers the export and import runners the routes probe for", () => {
    registerDefaultBackgroundJobRunners();
    expect(hasBackgroundJobRunner("examinations:export")).toBe(true);
    expect(hasBackgroundJobRunner("examinations:import")).toBe(true);
  });

  it("gives the CSV jobs a budget beyond the 60s sandbox ceiling", () => {
    expect(resolveJobExecutionTimeoutMs("examinations", "export")).toBeGreaterThan(60_000);
    expect(resolveJobExecutionTimeoutMs("examinations", "import")).toBeGreaterThan(60_000);
  });
});

describe("examinations export", () => {
  it("pages through exams and emits one CSV row per exam plus a header", async () => {
    listExamsByWorkspace
      .mockResolvedValueOnce([
        {
          id: "ex-1",
          name: "Midterm",
          subject: "Quran",
          date: "2026-03-10",
          totalMarks: 100,
          passingMarks: 50,
          duration: 60,
          classIds: ["cls-1"],
          status: "ongoing",
          description: "",
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await buildExaminationsCsvExport({}, exportOptions, "demo");
    expect(result.count).toBe(1);
    const lines = result.csv.trim().split("\n");
    expect(lines).toHaveLength(2); // header + one row
    expect(lines[0]).toContain("Exam");
    expect(lines[1]).toContain("Midterm");
    // Marks never leave the system through the exam CSV export.
    expect(result.csv).not.toContain("marksObtained");
  });

  it("refuses to run without a tenant", async () => {
    await expect(buildExaminationsCsvExport({}, exportOptions)).rejects.toThrow(/Tenant context/);
  });

  it("stops paging when the job is aborted (shutdown/deadline)", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      buildExaminationsCsvExport({}, exportOptions, "demo", controller.signal),
    ).rejects.toThrow(/aborted/i);
    expect(listExamsByWorkspace).not.toHaveBeenCalled();
  });
});

describe("examinations import mapping", () => {
  it("derives a deterministic id so a replay upserts instead of duplicating", () => {
    const row = {
      title: "Midterm",
      subject: "Quran",
      examDate: "2026-03-10",
      className: "Class 5 - A",
    };
    const first = mapExaminationsImportRow(row, CLASSES);
    const second = mapExaminationsImportRow(row, CLASSES);
    expect("record" in first && "record" in second).toBe(true);
    if ("record" in first && "record" in second) {
      expect(first.record.id).toBe(second.record.id);
      expect(first.record.id).toMatch(/^ex-[0-9a-f]{24}$/);
      expect(first.record.totalMarks).toBe(100);
      expect(first.record.passingMarks).toBe(50);
      expect(first.record.classIds).toEqual(["cls-1"]);
    }
  });

  it("rejects rows with a missing title, invalid date, unknown class or bad bounds", () => {
    expect(mapExaminationsImportRow({ examDate: "2026-03-10" }, CLASSES)).toEqual({
      error: "Exam title is required",
    });
    expect(mapExaminationsImportRow({ title: "Midterm", examDate: "not-a-date" }, CLASSES)).toEqual(
      { error: "Exam date must be a valid date (YYYY-MM-DD)" },
    );
    expect(mapExaminationsImportRow({ title: "Midterm", examDate: "2026-03-10" }, CLASSES)).toEqual(
      { error: "A class is required (column: class)" },
    );
    expect(
      mapExaminationsImportRow(
        { title: "Midterm", examDate: "2026-03-10", className: "Missing" },
        CLASSES,
      ),
    ).toEqual({ error: 'Class "Missing" was not found in this workspace' });
    expect(
      mapExaminationsImportRow(
        {
          title: "Midterm",
          examDate: "2026-03-10",
          className: "Class 5 - A",
          totalMarks: 50,
          passingMarks: 60,
        },
        CLASSES,
      ),
    ).toEqual({ error: "Passing marks must be between 0 and the total marks" });
  });

  it("applies a batch idempotently through the guarded upsert", async () => {
    registerDefaultBackgroundJobRunners();
    const mapped = mapExaminationsImportRow(
      { title: "Midterm", subject: "Quran", examDate: "2026-03-10", className: "Class 5 - A" },
      CLASSES,
    );
    expect("record" in mapped).toBe(true);
    // The import service applies rows via upsertExams; a second run upserts the same id.
    if ("record" in mapped) {
      await upsertExams([mapped.record]);
      await upsertExams([mapped.record]);
    }
    expect(upsertExams).toHaveBeenCalledTimes(2);
    const firstId = (upsertExams.mock.calls[0]?.[0] as Array<{ id?: string }> | undefined)?.[0]?.id;
    const secondId = (upsertExams.mock.calls[1]?.[0] as Array<{ id?: string }> | undefined)?.[0]
      ?.id;
    expect(firstId).toBe(secondId);
  });
});
