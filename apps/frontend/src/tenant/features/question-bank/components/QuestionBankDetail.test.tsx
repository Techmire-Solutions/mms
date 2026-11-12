import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QuestionBankQuestion } from "@mms/shared";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/lib/notify", () => ({ notify: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

vi.mock("@/tenant/features/question-bank/hooks/useQuestionBankMutations", () => ({
  useQuestionBankMutations: () => ({
    addQuestionAttachment: { mutateAsync: vi.fn(), isPending: false },
    removeQuestionAttachment: { mutateAsync: vi.fn(), isPending: false },
  }),
}));

import { QuestionBankDetail } from "./QuestionBankDetail";

const config = {
  categories: [],
  isFieldEnabled: () => true,
  typeLabel: (value: string) => value,
  difficultyLabel: (value: string) => value,
} as never;

const question: QuestionBankQuestion = {
  id: "q-1",
  categoryIds: ["fiqh"],
  type: "short",
  difficulty: "easy",
  questionLanguage: "en",
  text: "What is wudu?",
  options: [],
  answer: "Purity",
  marks: 2,
  status: "under_review",
};

describe("QuestionBankDetail lifecycle gating", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const render = (canApprove: boolean) =>
    act(() => {
      root.render(
        <QuestionBankDetail
          question={question}
          config={config}
          onClose={vi.fn()}
          canWrite
          canDelete={canApprove}
          canApprove={canApprove}
          onSetStatus={vi.fn()}
        />,
      );
    });

  it("does not offer approve/retire without approver authority", () => {
    render(false);
    // The drawer renders through a portal.
    expect(document.body.textContent).not.toContain("questionBank.action.approve");
    expect(document.body.textContent).toContain("questionBank.action.reopen");
  });

  it("offers approve when the caller holds the delete/approver grant", () => {
    render(true);
    expect(document.body.textContent).toContain("questionBank.action.approve");
  });
});
