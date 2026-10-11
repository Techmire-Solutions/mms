import { describe, expect, it, vi } from "vitest";
import { createQuestionBankUseCases } from "../questionBank/use-cases/questionBankUseCases.js";
import type { QuestionBankRepository } from "../questionBank/repository/questionBankRepository.js";
import { runWithTenant } from "../lib/tenantContext.js";

vi.mock("../db/repositories/questionBankModulePreferencesRepository.js", () => ({
  getQuestionBankModulePreferencesForWorkspace: vi.fn().mockResolvedValue(null),
}));

function createFakeRepo(): QuestionBankRepository {
  return {
    listQuestionsByWorkspace: vi.fn().mockResolvedValue([]),
    findQuestionById: vi.fn().mockResolvedValue(null),
    findQuestionsByIds: vi.fn().mockResolvedValue([]),
    saveQuestion: vi.fn().mockResolvedValue(undefined),
    bulkSaveQuestions: vi.fn().mockResolvedValue(undefined),
    replaceQuestionsForWorkspace: vi.fn().mockResolvedValue(undefined),
    listQuestionsPage: vi.fn().mockResolvedValue({
      questions: [],
      total: 0,
      page: 1,
      limit: 15,
      hasMore: false,
    }),
    listTestsByWorkspace: vi.fn().mockResolvedValue([]),
    findTestById: vi.fn().mockResolvedValue(null),
    findTestsByIds: vi.fn().mockResolvedValue([]),
    saveTest: vi.fn().mockResolvedValue(undefined),
    bulkSaveTests: vi.fn().mockResolvedValue(undefined),
    replaceTestsForWorkspace: vi.fn().mockResolvedValue(undefined),
    listResultsByWorkspace: vi.fn().mockResolvedValue([]),
    findResultById: vi.fn().mockResolvedValue(null),
    findResultsByIds: vi.fn().mockResolvedValue([]),
    saveResult: vi.fn().mockResolvedValue(undefined),
    bulkSaveResults: vi.fn().mockResolvedValue(undefined),
    replaceResultsForWorkspace: vi.fn().mockResolvedValue(undefined),
    aggregateQuestionBankCommandMetrics: vi.fn().mockResolvedValue({
      total: 4,
      easy: 1,
      medium: 2,
      hard: 1,
      totalTests: 2,
      totalResults: 3,
      categories: 0,
    }),
    aggregateQuestionBankWidgetQueries: vi.fn().mockResolvedValue({}),
    aggregateQuestionBankReport: vi.fn().mockResolvedValue({}),
  };
}

describe("questionBank use-cases (DI with fake repository)", () => {
  it("loadQuestionsPage delegates to the injected repository with the active tenant", async () => {
    const repo = createFakeRepo();
    const useCases = createQuestionBankUseCases(repo);

    const result = await runWithTenant("demo", () =>
      useCases.loadQuestionsPage({ page: 2, limit: 15 }),
    );

    expect(result).toEqual({ questions: [], total: 0, page: 1, limit: 15, hasMore: false });
    expect(repo.listQuestionsPage).toHaveBeenCalledWith("demo", { page: 2, limit: 15 });
  });

  it("loadQuestionBankCommandMetrics delegates to the injected repository", async () => {
    const repo = createFakeRepo();
    const useCases = createQuestionBankUseCases(repo);

    const result = await runWithTenant("demo", () => useCases.loadQuestionBankCommandMetrics());

    expect(result.total).toBe(4);
    expect(repo.aggregateQuestionBankCommandMetrics).toHaveBeenCalledWith("demo");
  });

  it("loadQuestionById delegates and filters soft-deleted items unless includeDeleted is set", async () => {
    const repo = createFakeRepo();
    const activeQuestion = {
      id: "q1",
      categoryIds: ["cat1"],
      type: "mcq" as const,
      difficulty: "easy" as const,
      questionLanguage: "en" as const,
      text: "What is 1 + 1?",
      options: ["1", "2"],
      answer: "2",
    };
    const deletedQuestion = {
      ...activeQuestion,
      id: "q2",
      deletedAt: "2026-09-01T00:00:00.000Z",
    };

    vi.mocked(repo.findQuestionById).mockImplementation(async (_t, id) => {
      if (id === "q1") return activeQuestion;
      if (id === "q2") return deletedQuestion;
      return null;
    });

    const useCases = createQuestionBankUseCases(repo);

    await runWithTenant("demo", async () => {
      const active = await useCases.loadQuestionById("  q1  ");
      expect(active).toEqual(activeQuestion);
      expect(repo.findQuestionById).toHaveBeenCalledWith("demo", "q1");

      const delHidden = await useCases.loadQuestionById("q2");
      expect(delHidden).toBeNull();

      const delVisible = await useCases.loadQuestionById("q2", true);
      expect(delVisible).toEqual(deletedQuestion);
    });
  });

  it("loadQuestionsByIds dedupes trimmed ids and delegates to repository", async () => {
    const repo = createFakeRepo();
    const q1 = {
      id: "q1",
      categoryIds: ["cat1"],
      type: "mcq" as const,
      difficulty: "easy" as const,
      questionLanguage: "en" as const,
      text: "Q1",
      options: ["a"],
      answer: "a",
    };
    const q2 = { ...q1, id: "q2", deletedAt: "2026-09-01T00:00:00.000Z" };
    vi.mocked(repo.findQuestionsByIds).mockImplementation(async (_t, _ids, opts) => {
      return opts?.includeDeleted || opts?.deleted === "deleted" ? [q2] : [q1];
    });

    const useCases = createQuestionBankUseCases(repo);

    await runWithTenant("demo", async () => {
      const results = await useCases.loadQuestionsByIds([" q1 ", "q2", "q1", "  "]);
      expect(repo.findQuestionsByIds).toHaveBeenCalledWith("demo", ["q1", "q2"], {
        includeDeleted: false,
      });
      expect(results).toEqual([q1]);

      const all = await useCases.loadQuestionsByIds(["q1", "q2"], true);
      expect(repo.findQuestionsByIds).toHaveBeenCalledWith("demo", ["q1", "q2"], {
        includeDeleted: true,
      });
      expect(all).toEqual([q2]);
    });
  });

  it("saveQuestion validates schema and delegates to repository", async () => {
    const repo = createFakeRepo();
    const useCases = createQuestionBankUseCases(repo);
    const validQuestion = {
      id: "q1",
      categoryIds: ["cat1"],
      type: "mcq" as const,
      difficulty: "easy" as const,
      questionLanguage: "en" as const,
      text: "Question text",
      options: ["a", "b"],
      answer: "a",
    };

    await runWithTenant("demo", async () => {
      await useCases.saveQuestion(validQuestion);
      expect(repo.saveQuestion).toHaveBeenCalledWith("demo", expect.objectContaining({ id: "q1" }));
    });
  });

  it("loadTestById and loadTestsByIds delegate and handle soft-deleted tests", async () => {
    const repo = createFakeRepo();
    const activeTest = {
      id: "t1",
      name: "Test 1",
      categoryId: null,
      questionIds: ["q1"],
      difficulty: "mixed" as const,
      duration: 60,
      createdAt: "2026-09-01T00:00:00.000Z",
    };
    const deletedTest = {
      ...activeTest,
      id: "t2",
      deletedAt: "2026-09-01T00:00:00.000Z",
    };

    vi.mocked(repo.findTestById).mockImplementation(async (_t, id) => {
      if (id === "t1") return activeTest;
      if (id === "t2") return deletedTest;
      return null;
    });
    vi.mocked(repo.findTestsByIds).mockImplementation(async (_t, _ids, opts) => {
      return opts?.includeDeleted || opts?.deleted === "deleted" ? [deletedTest] : [activeTest];
    });

    const useCases = createQuestionBankUseCases(repo);

    await runWithTenant("demo", async () => {
      const active = await useCases.loadTestById("  t1  ");
      expect(active).toEqual(activeTest);
      expect(repo.findTestById).toHaveBeenCalledWith("demo", "t1");

      const delHidden = await useCases.loadTestById("t2");
      expect(delHidden).toBeNull();

      const delVisible = await useCases.loadTestById("t2", true);
      expect(delVisible).toEqual(deletedTest);

      const activeList = await useCases.loadTestsByIds([" t1 ", "t2", "t1"]);
      expect(repo.findTestsByIds).toHaveBeenCalledWith("demo", ["t1", "t2"], {
        includeDeleted: false,
      });
      expect(activeList).toEqual([activeTest]);
    });
  });

  it("saveTest validates schema and delegates to repository", async () => {
    const repo = createFakeRepo();
    const useCases = createQuestionBankUseCases(repo);
    const validTest = {
      id: "t1",
      name: "Math Quiz",
      categoryId: null,
      questionIds: ["q1"],
      difficulty: "easy" as const,
      duration: 45,
      createdAt: "2026-09-01T00:00:00.000Z",
    };

    await runWithTenant("demo", async () => {
      await useCases.saveTest(validTest);
      expect(repo.saveTest).toHaveBeenCalledWith("demo", expect.objectContaining({ id: "t1" }));
    });
  });

  it("loadResultById and loadResultsByIds delegate and handle soft-deleted results", async () => {
    const repo = createFakeRepo();
    const activeResult = {
      id: "r1",
      testId: "t1",
      studentId: "s1",
      studentName: "Zayd",
      submittedAt: "2026-09-01T10:00:00.000Z",
      answers: { q1: "a" },
      scores: { q1: 1 },
    };
    const deletedResult = {
      ...activeResult,
      id: "r2",
      deletedAt: "2026-09-01T00:00:00.000Z",
    };

    vi.mocked(repo.findResultById).mockImplementation(async (_t, id) => {
      if (id === "r1") return activeResult;
      if (id === "r2") return deletedResult;
      return null;
    });
    vi.mocked(repo.findResultsByIds).mockImplementation(async (_t, _ids, opts) => {
      return opts?.includeDeleted || opts?.deleted === "deleted" ? [deletedResult] : [activeResult];
    });

    const useCases = createQuestionBankUseCases(repo);

    await runWithTenant("demo", async () => {
      const active = await useCases.loadResultById("  r1  ");
      expect(active).toEqual(activeResult);
      expect(repo.findResultById).toHaveBeenCalledWith("demo", "r1");

      const delHidden = await useCases.loadResultById("r2");
      expect(delHidden).toBeNull();

      const delVisible = await useCases.loadResultById("r2", true);
      expect(delVisible).toEqual(deletedResult);

      const activeList = await useCases.loadResultsByIds([" r1 ", "r2", "r1"]);
      expect(repo.findResultsByIds).toHaveBeenCalledWith("demo", ["r1", "r2"], {
        includeDeleted: false,
      });
      expect(activeList).toEqual([activeResult]);
    });
  });

  it("saveResult validates schema and delegates to repository", async () => {
    const repo = createFakeRepo();
    const useCases = createQuestionBankUseCases(repo);
    const validResult = {
      id: "r1",
      testId: "t1",
      studentId: "s1",
      studentName: "Zayd",
      submittedAt: "2026-09-01T10:00:00.000Z",
      answers: { q1: "a" },
      scores: { q1: 1 },
    };

    await runWithTenant("demo", async () => {
      await useCases.saveResult(validResult);
      expect(repo.saveResult).toHaveBeenCalledWith("demo", expect.objectContaining({ id: "r1" }));
    });
  });

  it("returns empty defaults when no tenant context is bound", async () => {
    const repo = createFakeRepo();
    const useCases = createQuestionBankUseCases(repo);

    const page = await useCases.loadQuestionsPage({ page: 1, limit: 15 });
    const metrics = await useCases.loadQuestionBankCommandMetrics();
    const qById = await useCases.loadQuestionById("q1");
    const qByIds = await useCases.loadQuestionsByIds(["q1"]);
    const tById = await useCases.loadTestById("t1");
    const tByIds = await useCases.loadTestsByIds(["t1"]);
    const rById = await useCases.loadResultById("r1");
    const rByIds = await useCases.loadResultsByIds(["r1"]);

    expect(page).toEqual({ questions: [], total: 0, page: 1, limit: 15, hasMore: false });
    expect(metrics.total).toBe(0);
    expect(qById).toBeNull();
    expect(qByIds).toEqual([]);
    expect(tById).toBeNull();
    expect(tByIds).toEqual([]);
    expect(rById).toBeNull();
    expect(rByIds).toEqual([]);

    expect(repo.listQuestionsPage).not.toHaveBeenCalled();
    expect(repo.aggregateQuestionBankCommandMetrics).not.toHaveBeenCalled();
    expect(repo.findQuestionById).not.toHaveBeenCalled();
    expect(repo.findQuestionsByIds).not.toHaveBeenCalled();
    expect(repo.findTestById).not.toHaveBeenCalled();
    expect(repo.findTestsByIds).not.toHaveBeenCalled();
    expect(repo.findResultById).not.toHaveBeenCalled();
    expect(repo.findResultsByIds).not.toHaveBeenCalled();
  });
});
