import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuestionMediaSection } from "./QuestionMediaSection";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  uploadAttachmentFile: vi.fn(),
  deleteAttachmentFile: vi.fn().mockResolvedValue({ deleted: true }),
  addAttachment: vi.fn(),
  removeAttachment: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock("@mms/fe-core/lib/attachmentUpload", () => ({
  uploadAttachmentFile: mocks.uploadAttachmentFile,
  deleteAttachmentFile: mocks.deleteAttachmentFile,
}));
vi.mock("@mms/fe-core/notify", () => ({
  notify: { success: vi.fn(), error: mocks.notifyError, info: vi.fn(), warning: vi.fn() },
}));
vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("../hooks/useQuestionBankMutations", () => ({
  useQuestionBankMutations: () => ({
    addQuestionAttachment: { mutateAsync: mocks.addAttachment, isPending: false },
    removeQuestionAttachment: { mutateAsync: mocks.removeAttachment, isPending: false },
  }),
}));

const question = {
  id: "q-1",
  text: "What is 2 + 2?",
  options: ["3", "4"],
  attachments: [],
};

const uploaded = {
  url: "/uploads/tenant/acme/question-media/stem.png",
  name: "stem.png",
  type: "image/png",
  size: 1024,
};

describe("QuestionMediaSection upload cleanup", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.uploadAttachmentFile.mockReset().mockResolvedValue(uploaded);
    mocks.deleteAttachmentFile.mockReset().mockResolvedValue({ deleted: true });
    mocks.addAttachment.mockReset();
    mocks.notifyError.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function pickFile(): Promise<void> {
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["png"], "stem.png", { type: "image/png" });
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((resolve: any) => setTimeout(resolve, 0));
    });
  }

  it("unlinks the uploaded file when the attach call fails", async () => {
    mocks.addAttachment.mockRejectedValue(new Error("attach failed"));
    await act(async () => {
      root.render(<QuestionMediaSection question={question as never} canWrite />);
    });

    await pickFile();

    expect(mocks.uploadAttachmentFile).toHaveBeenCalledWith(expect.any(File), "question_media");
    expect(mocks.addAttachment).toHaveBeenCalledTimes(1);
    // The orphan is removed with the URL the upload returned, and the failure is still reported.
    expect(mocks.deleteAttachmentFile).toHaveBeenCalledTimes(1);
    expect(mocks.deleteAttachmentFile).toHaveBeenCalledWith(uploaded.url);
    expect(mocks.notifyError).toHaveBeenCalledWith(
      "questionBank.mediaUploadFailed",
      expect.objectContaining({ description: "attach failed" }),
    );
  });

  it("keeps the file when the attach succeeds", async () => {
    mocks.addAttachment.mockResolvedValue(undefined);
    await act(async () => {
      root.render(<QuestionMediaSection question={question as never} canWrite />);
    });

    await pickFile();

    expect(mocks.addAttachment).toHaveBeenCalledWith("q-1", {
      kind: "stem",
      optionIndex: null,
      url: uploaded.url,
      name: uploaded.name,
      mime: uploaded.type,
      size: uploaded.size,
    });
    expect(mocks.deleteAttachmentFile).not.toHaveBeenCalled();
    expect(mocks.notifyError).not.toHaveBeenCalled();
  });
});
