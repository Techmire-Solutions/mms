import { describe, expect, it, vi } from "vitest";

const upsertSpy = vi.hoisted(() => vi.fn(async (records: unknown[]) => records));
vi.mock("../questionBank/use-cases/questionBankUseCases.js", () => ({
  questionBankUseCases: { upsertQuestions: upsertSpy },
}));

import {
  questionImportId,
  runQuestionBankImportJob,
} from "../services/questionBankImportJobService.js";

const rows = [
  { title: "Define wudu", category: "fiqh", type: "short", explanation: "Purity", points: "3" },
  {
    title: "What is the capital of Egypt?",
    category: "geography",
    type: "mcq",
    options: "Cairo | Alexandria | Giza",
    explanation: "Cairo",
  },
  { title: "Bad row" },
];

const context = {
  tenant: "demo",
  userId: "u-1",
  jobId: "job-1",
  viewerRole: "admin",
  updateProgress: async () => undefined,
};

describe("question bank import job", () => {
  it("maps valid rows, reports invalid ones and forces drafts", async () => {
    upsertSpy.mockClear();
    const result = await runQuestionBankImportJob(rows, context);

    expect(result).toMatchObject({ imported: 2, failed: 1, total: 3 });
    expect(result.errors[0]).toMatchObject({ row: 3 });

    const written = upsertSpy.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    expect(written[0]).toMatchObject({
      id: questionImportId("demo", "job-1", 0),
      status: "draft",
      text: "Define wudu",
      answer: "Purity",
      marks: 3,
    });
    expect(written[1]).toMatchObject({
      type: "mcq",
      options: ["Cairo", "Alexandria", "Giza"],
      answer: "Cairo",
      status: "draft",
    });
  });

  it("is deterministic for the same job id", async () => {
    upsertSpy.mockClear();
    await runQuestionBankImportJob(rows, context);
    const first = (upsertSpy.mock.calls[0]?.[0] as Array<{ id: string }>)[0]?.id;
    upsertSpy.mockClear();
    await runQuestionBankImportJob(rows, context);
    const second = (upsertSpy.mock.calls[0]?.[0] as Array<{ id: string }>)[0]?.id;
    expect(second).toBe(first);
  });

  it("stops between chunks when the signal aborts", async () => {
    upsertSpy.mockClear();
    const controller = new AbortController();
    controller.abort();
    await expect(
      runQuestionBankImportJob(rows, { ...context, signal: controller.signal }),
    ).rejects.toThrow(/aborted/i);
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it("reports progress as chunks complete", async () => {
    upsertSpy.mockClear();
    const progress: Array<[number, number]> = [];
    await runQuestionBankImportJob(rows, {
      ...context,
      updateProgress: async (current, total) => {
        progress.push([current, total]);
      },
    });
    // Progress counts processed rows (imported + rejected).
    expect(progress.at(-1)).toEqual([3, 3]);
  });
});
