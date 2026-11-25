import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/apiError";
import { QuestionForm } from "./QuestionForm";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", async () => {
  const { useTranslationEnMock } = await import("@/test/useTranslationEnMock");
  return { useTranslation: useTranslationEnMock() };
});
vi.mock("@mms/fe-core/i18n", async () => {
  const { useTranslationEnMock } = await import("@/test/useTranslationEnMock");
  return { useTranslation: useTranslationEnMock() };
});
vi.mock("@/lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock("@/tenant/features/question-bank/hooks/useQuestionBankConfig", () => ({
  useQuestionBankConfig: () => ({
    settings: { categories: [], sourceBooks: [] },
    categories: [],
    sourceBooks: [],
    updateSettingsAsync: vi.fn(),
  }),
}));
vi.mock("@/tenant/features/question-bank/hooks/useQuestionDuplicateCheck", () => ({
  useQuestionDuplicateCheck: () => [],
}));
vi.mock("@/tenant/features/question-bank/components/QuestionFormClassificationSection", () => ({
  QuestionFormClassificationSection: () => null,
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

type Mounted = {
  root: Root;
  container: HTMLDivElement;
  onSave: ReturnType<typeof vi.fn>;
  onClose: ReturnType<typeof vi.fn>;
};

function mount(onSave: ReturnType<typeof vi.fn>): Mounted {
  const onClose = vi.fn();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <QuestionForm
        open
        question={validQuestion as never}
        onClose={onClose}
        onSave={onSave as never}
        questions={[] as never}
      />,
    );
  });
  return { root, container, onSave, onClose };
}

async function submit(): Promise<void> {
  const form = document.querySelector("form#question-form") as HTMLFormElement;
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function typeIntoText(text: string): Promise<void> {
  const textarea = document.querySelector("#qb-text") as HTMLTextAreaElement;
  await act(async () => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setValue?.call(textarea, text);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("QuestionForm draft lifecycle", () => {
  let mounted: Mounted | null = null;

  beforeEach(() => {
    mounted = null;
  });

  afterEach(async () => {
    if (mounted) {
      await act(async () => mounted?.root.unmount());
      mounted.container.remove();
    }
    document.body.innerHTML = "";
  });

  it("marks the offending field from a 422 fieldErrors payload and keeps the modal open", async () => {
    const onSave = vi.fn().mockRejectedValue(
      new ApiError(422, "Question text is not acceptable", "validation_error", undefined, {
        fieldErrors: { text: "Question text is not acceptable" },
      }),
    );
    mounted = mount(onSave);

    await submit();

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(mounted.onClose).not.toHaveBeenCalled();
    // Inline under the field the resolver also uses, with the error wired to the control.
    const textarea = document.querySelector("#qb-text") as HTMLTextAreaElement;
    expect(textarea.getAttribute("aria-invalid")).toBe("true");
    expect(document.querySelector("#qb-text-error")?.textContent).toBe(
      "Question text is not acceptable",
    );
    // The banner carries only the residual form-level message, never a second copy of the field text.
    expect(document.body.textContent?.split("Question text is not acceptable").length).toBe(2);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it("asks to discard an edited draft on Escape and only closes after confirming", async () => {
    mounted = mount(vi.fn().mockResolvedValue(undefined));

    await typeIntoText("What is 2 + 2? (edited)");
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(mounted.onClose).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Unsaved Changes");
    expect(document.body.textContent).toContain(
      "You have unsaved changes. Discard them and close?",
    );

    const discard = [...document.querySelectorAll("button")].find(
      (button) => button.textContent === "Yes",
    );
    await act(async () => discard?.click());
    expect(mounted.onClose).toHaveBeenCalledTimes(1);
  });

  it("closes an untouched draft without asking", async () => {
    mounted = mount(vi.fn().mockResolvedValue(undefined));

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    expect(mounted.onClose).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain("Unsaved Changes");
  });
});
