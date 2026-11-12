import { describe, expect, it, vi } from "vitest";

const pageSpy = vi.hoisted(() => vi.fn());
vi.mock("../questionBank/repository/questionBankRepositoryAdapter.js", () => ({
  questionBankRepository: { listQuestionsPage: pageSpy },
}));

import {
  buildQuestionBankCsvExport,
  generateQuestionBankCsvStreamChunks,
} from "../services/questionBankExportService.js";

const question = {
  id: "q-1",
  categoryIds: ["fiqh"],
  type: "short",
  difficulty: "easy",
  questionLanguage: "en",
  text: "What is wudu?",
  options: [],
  answer: "purity",
  marks: 2,
  status: "approved",
};

describe("question bank CSV export", () => {
  it("writes the transfer columns and escapes cell content", async () => {
    pageSpy.mockResolvedValue({
      questions: [{ ...question, text: 'What is "wudu", exactly?' }],
      total: 1,
      page: 1,
      limit: 100,
      hasMore: false,
    });

    const result = await buildQuestionBankCsvExport({}, { viewerRole: "admin" }, "demo");
    expect(result.count).toBe(1);
    expect(result.csv.split("\n")[0]).toContain("Question Stem / Title");
    expect(result.csv).toContain('"What is ""wudu"", exactly?"');
    expect(result.filename).toBe("question-bank.csv");
  });

  it("pages until the list is exhausted and honours includeIds", async () => {
    pageSpy
      .mockResolvedValueOnce({
        questions: [question],
        total: 3,
        page: 1,
        limit: 100,
        hasMore: true,
      })
      .mockResolvedValueOnce({
        questions: [{ ...question, id: "q-2", text: "Second" }],
        total: 3,
        page: 2,
        limit: 100,
        hasMore: false,
      });

    const result = await buildQuestionBankCsvExport(
      { includeIds: ["q-2"] },
      { viewerRole: "admin" },
      "demo",
    );
    expect(result.count).toBe(1);
    expect(result.csv).toContain("Second");
    expect(result.csv).not.toContain("What is wudu?");
  });

  it("neutralises spreadsheet formula injection in exported cells", async () => {
    pageSpy.mockResolvedValue({
      questions: [{ ...question, text: '=HYPERLINK("http://evil")', answer: "+cmd" }],
      total: 1,
      page: 1,
      limit: 100,
      hasMore: false,
    });

    const result = await buildQuestionBankCsvExport({}, { viewerRole: "admin" }, "demo");
    expect(result.csv).toContain("'=HYPERLINK");
    expect(result.csv).toContain("'+cmd");
  });

  it("streams the header once and one chunk per page", async () => {
    pageSpy
      .mockResolvedValueOnce({
        questions: [
          {
            ...question,
            id: "q-mcq",
            type: "mcq",
            options: ["Cairo", "Giza"],
            answer: "Cairo",
          },
        ],
        total: 2,
        page: 1,
        limit: 100,
        hasMore: true,
      })
      .mockResolvedValueOnce({
        questions: [{ ...question, id: "q-2", text: "Second" }],
        total: 2,
        page: 2,
        limit: 100,
        hasMore: false,
      });

    const chunks: string[] = [];
    const generator = generateQuestionBankCsvStreamChunks({}, { viewerRole: "admin" }, "demo");
    let next = await generator.next();
    while (!next.done) {
      chunks.push(next.value);
      next = await generator.next();
    }

    expect(chunks[0]?.split("\n")).toHaveLength(1); // header only
    expect(chunks[1]).toContain("Cairo | Giza");
    expect(chunks[2]).toContain("Second");
    expect(next.value).toEqual({ count: 2, filename: "question-bank.csv" });
  });

  it("requires a tenant and observes aborts", async () => {
    await expect(buildQuestionBankCsvExport({}, { viewerRole: "admin" })).rejects.toThrow(
      /tenant/i,
    );

    const controller = new AbortController();
    controller.abort();
    await expect(
      buildQuestionBankCsvExport({}, { viewerRole: "admin" }, "demo", controller.signal),
    ).rejects.toThrow(/aborted/i);
  });
});
