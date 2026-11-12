import { describe, expect, it, vi } from "vitest";
import type { QuestionBankRepository } from "../questionBank/repository/questionBankRepository.js";
import { scoreResultsForTenant } from "../questionBank/use-cases/questionBankResultScoring.js";

function repoWith(tests: unknown[], questions: unknown[]): QuestionBankRepository {
  return {
    findTestsByIds: vi.fn().mockResolvedValue(tests),
    findQuestionsByIds: vi.fn().mockResolvedValue(questions),
  } as unknown as QuestionBankRepository;
}

function result(overrides: Record<string, unknown> = {}) {
  return {
    id: "r1",
    testId: "t1",
    studentId: "s1",
    studentName: "Student",
    submittedAt: "2026-01-01",
    answers: {},
    scores: {},
    ...overrides,
  } as never;
}

describe("scoreResultsForTenant", () => {
  it("awards the question's marks for a correct answer and zero otherwise", async () => {
    const repo = repoWith(
      [{ id: "t1", name: "Paper", questionIds: ["q1", "q2"] }],
      [
        { id: "q1", type: "mcq", options: ["a", "b"], answer: "a", marks: 3 },
        { id: "q2", type: "true_false", options: ["True", "False"], answer: "True", marks: 1 },
      ],
    );

    const [scored] = await scoreResultsForTenant(repo, "demo", [
      result({ answers: { q1: "a", q2: "False" }, scores: { q1: 99 } }),
    ]);

    expect(scored.scores).toEqual({ q1: 3, q2: 0 });
  });

  it("ignores answers for questions that are not on the paper", async () => {
    const repo = repoWith(
      [{ id: "t1", name: "Paper", questionIds: ["q1"] }],
      [{ id: "q1", type: "short", options: [], answer: "x", marks: 2 }],
    );

    const [scored] = await scoreResultsForTenant(repo, "demo", [
      result({ answers: { q1: "x", "q-unknown": "x" } }),
    ]);

    expect(scored.scores).toEqual({ q1: 2 });
  });

  it("returns no scores when the paper cannot be resolved", async () => {
    const repo = repoWith([], []);
    const [scored] = await scoreResultsForTenant(repo, "demo", [result()]);
    expect(scored.scores).toEqual({});
  });
});
