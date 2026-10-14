import { describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { QuestionForm } from "./QuestionForm";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const notifyMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}));

vi.mock("@/lib/notify", () => ({ notify: notifyMock }));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key, dir: "ltr", language: "en" }),
}));

vi.mock("@/tenant/features/question-bank/hooks/useQuestionBankConfig", () => ({
  useQuestionBankConfig: () => ({
    settings: { categories: [], sourceBooks: [] },
    categories: [],
    sourceBooks: [],
    updateSettingsAsync: vi.fn(),
  }),
}));

vi.mock("@/components/app/FormModal", () => ({
  FormModal: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/tenant/features/question-bank/components/QuestionFormClassificationSection", () => ({
  QuestionFormClassificationSection: () => null,
}));
vi.mock("@/tenant/features/question-bank/components/QuestionFormContentSection", () => ({
  QuestionFormContentSection: () => null,
}));
vi.mock("@/tenant/features/question-bank/components/QuestionFormSourcesSection", () => ({
  QuestionFormSourcesSection: () => null,
}));

const validQuestion = {
  id: "q-1",
  categoryIds: ["c-1"],
  type: "mcq",
  difficulty: "easy",
  questionLanguage: "en",
  text: "What is 2 + 2?",
  options: ["3", "4", "5"],
  answer: "4",
  sourceCitations: [],
};

function mount(question: unknown) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <QuestionForm open question={question as never} onClose={onClose} onSave={onSave} />,
    );
  });
  return { container, onSave, onClose };
}

async function submit(container: HTMLElement) {
  const form = container.querySelector("form#question-form")!;
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("QuestionForm", () => {
  it("saves a valid question through the shared resolver", async () => {
    const { container, onSave, onClose } = mount(validQuestion);

    await submit(container);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ id: "q-1", text: "What is 2 + 2?" });
    expect(notifyMock.success).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("does not save when required fields are empty", async () => {
    const { container, onSave } = mount(null);

    await submit(container);

    expect(onSave).not.toHaveBeenCalled();
    expect(notifyMock.success).not.toHaveBeenCalled();
  });
});
