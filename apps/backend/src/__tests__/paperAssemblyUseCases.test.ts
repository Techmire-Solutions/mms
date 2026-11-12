import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/tenantContext.js", () => ({ getRequestTenant: () => "demo" }));
vi.mock("../lib/livePush.js", () => ({ broadcastCollection: vi.fn() }));
vi.mock("../lib/createCollectionAuditHelper.js", () => ({
  createCollectionAuditHelper: () => vi.fn().mockResolvedValue(undefined),
}));

const { mockRepo } = vi.hoisted(() => ({
  mockRepo: { assemblePaper: vi.fn(), findTestById: vi.fn() },
}));
vi.mock("../questionBank/repository/questionBankRepositoryAdapter.js", () => ({
  questionBankRepository: mockRepo,
}));

const { assemblePaper } = await import("../questionBank/use-cases/paperAssemblyUseCases.js");

const user = { id: "u-1" } as never;
const blueprint = { excludeRecentlyUsedDays: 0, buckets: [{ categoryId: "fiqh", count: 3 }] };

describe("paperAssembly use case", () => {
  it("parses the blueprint, delegates to the engine and reports deficits", async () => {
    mockRepo.findTestById.mockResolvedValue({ id: "t1", name: "Paper" });
    mockRepo.assemblePaper.mockResolvedValue({
      result: {
        seedUsed: "t1",
        selected: [{ questionId: "q1", bucketIndex: 0 }],
        totalMarks: 5,
        deficits: [
          {
            bucketIndex: 0,
            requestedCount: 3,
            selectedCount: 1,
            requestedMarks: 0,
            selectedMarks: 0,
            reason: "insufficient_candidates",
          },
        ],
      },
      questionIds: ["q1"],
    });

    const result = await assemblePaper(user, { testId: "t1", blueprint });

    expect(mockRepo.assemblePaper).toHaveBeenCalledWith("demo", {
      testId: "t1",
      blueprint: expect.objectContaining({ buckets: [{ categoryId: "fiqh", count: 3 }] }),
      actorId: "u-1",
    });
    expect(result).toMatchObject({
      seedUsed: "t1",
      selectedCount: 1,
      totalMarks: 5,
      deficits: [expect.objectContaining({ bucketIndex: 0 })],
    });
  });

  it("rejects a blueprint without a target before touching the repository", async () => {
    mockRepo.assemblePaper.mockClear();
    await expect(
      assemblePaper(user, { testId: "t1", blueprint: { buckets: [{}] } }),
    ).rejects.toThrow();
    expect(mockRepo.assemblePaper).not.toHaveBeenCalled();
  });
});
