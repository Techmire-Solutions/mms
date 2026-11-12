import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/tenantContext.js", () => ({ getRequestTenant: () => "demo" }));
vi.mock("../lib/livePush.js", () => ({ broadcastCollection: vi.fn() }));
vi.mock("../lib/createCollectionAuditHelper.js", () => ({
  createCollectionAuditHelper: () => vi.fn().mockResolvedValue(undefined),
}));

const { mockRepo } = vi.hoisted(() => ({
  mockRepo: {
    findQuestionById: vi.fn(),
    addQuestionAttachment: vi.fn(),
    removeQuestionAttachment: vi.fn(),
    isQuestionAttachmentReferenced: vi.fn(),
  },
}));
vi.mock("../questionBank/repository/questionBankRepositoryAdapter.js", () => ({
  questionBankRepository: mockRepo,
}));

const mockUnlink = vi.fn().mockResolvedValue(true);
vi.mock("../services/questionMediaStorageService.js", () => ({
  deleteQuestionMediaFile: (...args: unknown[]) => mockUnlink(...args),
}));

const { attachQuestionMedia, detachQuestionMedia } =
  await import("../questionBank/use-cases/questionAttachmentUseCases.js");

const user = { id: "u-1" } as never;

describe("question media use cases", () => {
  it("attaches a tenant question-media URL", async () => {
    mockRepo.findQuestionById.mockResolvedValue({ id: "q1", deletedAt: null });
    mockRepo.addQuestionAttachment.mockResolvedValue({ id: "att-1", kind: "stem", url: "x" });

    const attachment = await attachQuestionMedia(user, {
      questionId: "q1",
      kind: "stem",
      url: "/uploads/tenants/demo/question-media/diagram.webp",
      name: "diagram.webp",
      mime: "image/webp",
      size: 1200,
    });

    expect(mockRepo.addQuestionAttachment).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({
        questionId: "q1",
        kind: "stem",
        optionIndex: null,
        url: "/uploads/tenants/demo/question-media/diagram.webp",
      }),
    );
    expect(attachment).toMatchObject({ id: "att-1" });
  });

  it("rejects a URL from another tenant or another category", async () => {
    mockRepo.findQuestionById.mockResolvedValue({ id: "q1", deletedAt: null });
    await expect(
      attachQuestionMedia(user, {
        questionId: "q1",
        kind: "stem",
        url: "/uploads/tenants/other/question-media/a.webp",
        name: "a.webp",
        mime: "image/webp",
        size: 1,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    await expect(
      attachQuestionMedia(user, {
        questionId: "q1",
        kind: "stem",
        url: "/uploads/tenants/demo/attachments/a.pdf",
        name: "a.pdf",
        mime: "application/pdf",
        size: 1,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("unlinks the file on detach only when nothing references it", async () => {
    mockRepo.removeQuestionAttachment.mockResolvedValue(
      "/uploads/tenants/demo/question-media/a.webp",
    );
    mockRepo.isQuestionAttachmentReferenced.mockResolvedValue(false);
    await detachQuestionMedia(user, { questionId: "q1", attachmentId: "att-1" });
    expect(mockUnlink).toHaveBeenCalledWith("demo", "/uploads/tenants/demo/question-media/a.webp");

    mockUnlink.mockClear();
    mockRepo.isQuestionAttachmentReferenced.mockResolvedValue(true);
    await detachQuestionMedia(user, { questionId: "q1", attachmentId: "att-1" });
    expect(mockUnlink).not.toHaveBeenCalled();
  });
});
