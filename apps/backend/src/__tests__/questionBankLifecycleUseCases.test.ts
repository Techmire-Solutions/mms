import { describe, expect, it, vi } from "vitest";
import type { QuestionBankRepository } from "../questionBank/repository/questionBankRepository.js";

vi.mock("../lib/tenantContext.js", () => ({ getRequestTenant: () => "demo" }));
vi.mock("../lib/livePush.js", () => ({ broadcastCollection: vi.fn() }));
vi.mock("../lib/createCollectionAuditHelper.js", () => ({
  createCollectionAuditHelper: () => vi.fn().mockResolvedValue(undefined),
}));

const { createQuestionBankLifecycleUseCases } =
  await import("../questionBank/use-cases/questionBankLifecycleUseCases.js");

const user = { id: "u-1" } as never;

function repoWith(overrides: Partial<QuestionBankRepository>): QuestionBankRepository {
  return overrides as QuestionBankRepository;
}

describe("questionBank lifecycle use-cases", () => {
  it("delegates a status move with the acting user and returns the updated record", async () => {
    const updateQuestionStatus = vi.fn().mockResolvedValue({ id: "q1", status: "approved" });
    const useCases = createQuestionBankLifecycleUseCases(repoWith({ updateQuestionStatus }));

    const updated = await useCases.setQuestionStatus(user, {
      id: "q1",
      status: "approved",
      reason: "checked",
    });

    expect(updateQuestionStatus).toHaveBeenCalledWith("demo", {
      id: "q1",
      to: "approved",
      actorId: "u-1",
      reason: "checked",
    });
    expect(updated).toMatchObject({ status: "approved" });
  });

  it("clones a question under a generated id", async () => {
    const duplicateQuestionRow = vi.fn().mockResolvedValue({ id: "q-new", status: "draft" });
    const useCases = createQuestionBankLifecycleUseCases(repoWith({ duplicateQuestionRow }));

    const clone = await useCases.duplicateQuestion(user, "q1");

    expect(duplicateQuestionRow).toHaveBeenCalledWith("demo", {
      sourceId: "q1",
      newId: expect.stringMatching(/^q-/),
      actorId: "u-1",
    });
    expect(clone).toMatchObject({ id: "q-new" });
  });

  it("publishes a paper and returns the refreshed record", async () => {
    const setPaperPublished = vi.fn().mockResolvedValue(undefined);
    const findTestById = vi
      .fn()
      .mockResolvedValue({ id: "t1", publishedAt: "2026-01-01T00:00:00Z" });
    const useCases = createQuestionBankLifecycleUseCases(
      repoWith({ setPaperPublished, findTestById }),
    );

    const test = await useCases.setTestPublished(user, { testId: "t1", published: true });

    expect(setPaperPublished).toHaveBeenCalledWith("demo", {
      testId: "t1",
      published: true,
      actorId: "u-1",
    });
    expect(test).toMatchObject({ id: "t1" });
  });
});
