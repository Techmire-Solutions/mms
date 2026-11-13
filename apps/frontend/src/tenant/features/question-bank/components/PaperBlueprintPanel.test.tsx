import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QuestionBankQuestion, QuestionBankTest } from "@mms/shared";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params?.count === undefined ? key : `${key}:${String(params.count)}`,
  }),
}));

vi.mock("@shared/ui", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    FormSelect: ({
      id,
      value,
      onChange,
      options = [],
    }: {
      id?: string;
      value?: string;
      onChange?: (value: string) => void;
      options?: Array<{ value: string; label: string }>;
    }) => (
      <select id={id} value={value ?? ""} onChange={(event) => onChange?.(event.target.value)}>
        <option value="">—</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ),
  };
});

vi.mock("@/tenant/features/question-bank/hooks/useQuestionBankConfig", () => ({
  useQuestionBankConfig: () => ({
    categories: [{ id: "fiqh", name: "Fiqh", icon: "📘", color: "#111" }],
  }),
}));

const assembleSpy = vi.hoisted(() => vi.fn());
vi.mock("@/tenant/features/question-bank/hooks/useQuestionBankMutations", () => ({
  useQuestionBankMutations: () => ({
    assemblePaper: { mutateAsync: assembleSpy, isPending: false },
  }),
}));

vi.mock("@/lib/notify", () => ({ notify: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));

import { PaperBlueprintPanel } from "./PaperBlueprintPanel";

const question = (id: string): QuestionBankQuestion => ({
  id,
  categoryIds: ["fiqh"],
  type: "short",
  difficulty: "easy",
  questionLanguage: "en",
  text: `Question ${id}`,
  options: [],
  answer: "a",
  marks: 5,
  status: "approved",
});

const questions = [question("q-1"), question("q-2")];
const tests: QuestionBankTest[] = [
  {
    id: "paper-1",
    name: "Term 1",
    categoryId: null,
    questionIds: [],
    difficulty: "mixed",
    duration: 60,
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

describe("PaperBlueprintPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    assembleSpy.mockReset();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  const render = () =>
    act(() => {
      root.render(<PaperBlueprintPanel questions={questions} tests={tests} canWrite />);
    });

  it("shows the available question count per bucket", () => {
    render();
    expect(container.textContent).toContain("questionBank.blueprintAvailable:2");
  });

  it("previews selected questions and marks once a paper is chosen", () => {
    render();
    const paperSelect = container.querySelector<HTMLSelectElement>("select#qb-blueprint-paper");
    act(() => {
      paperSelect!.value = "paper-1";
      paperSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(container.textContent).toContain("questionBank.blueprintPreviewMarks");
    expect(container.textContent).not.toContain("questionBank.blueprintAssembleFailed");
  });

  it("flags an invalid bucket count instead of coercing it", () => {
    render();
    const count = container.querySelector<HTMLInputElement>("input#qb-bp-count-0");
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(count, "0");
      count!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(container.textContent).toContain("questionBank.blueprintInvalidCount");
  });

  it("surfaces an assembly failure", async () => {
    assembleSpy.mockRejectedValueOnce(new Error("paper_locked"));
    render();
    const paperSelect = container.querySelector<HTMLSelectElement>("select#qb-blueprint-paper");
    act(() => {
      paperSelect!.value = "paper-1";
      paperSelect!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const assembleButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "questionBank.blueprintAssemble",
    );
    await act(async () => {
      assembleButton?.click();
    });
    expect(container.textContent).toContain("questionBank.blueprintAssembleFailed");
  });
});
