import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/tenantContext.js", () => ({ getRequestTenant: () => "demo" }));

const { mockRepo } = vi.hoisted(() => ({ mockRepo: { findSimilarQuestions: vi.fn() } }));
vi.mock("../questionBank/repository/questionBankRepositoryAdapter.js", () => ({
  questionBankRepository: mockRepo,
}));

const { checkQuestionDuplicates } =
  await import("../questionBank/use-cases/questionDuplicateUseCases.js");

describe("checkQuestionDuplicates", () => {
  it("returns ranked matches for a comparable stem", async () => {
    mockRepo.findSimilarQuestions.mockResolvedValue([{ id: "q9", text: "same", score: 0.91 }]);
    const result = await checkQuestionDuplicates({
      text: "Explain the significance of the event of Ghadir Khumm.",
    });
    expect(mockRepo.findSimilarQuestions).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({ text: expect.stringContaining("Ghadir") }),
    );
    expect(result.matches).toHaveLength(1);
  });

  it("skips the query for a very short stem", async () => {
    mockRepo.findSimilarQuestions.mockClear();
    const result = await checkQuestionDuplicates({ text: "2+2?" });
    expect(result.matches).toEqual([]);
    expect(mockRepo.findSimilarQuestions).not.toHaveBeenCalled();
  });
});
