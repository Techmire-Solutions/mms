import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QuestionBankQuestion as Question } from "@mms/shared";
import { PrintablePaper } from "./PrintablePaper";
import { PrintableAnswerSheet } from "./PrintableAnswerSheet";
import type {
  PaperConfig,
  PaperSection,
} from "@/tenant/features/question-bank/lib/paperBuilderUtils";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key, language: "en", dir: "ltr" }),
}));

const config: PaperConfig = {
  name: "Term 1 Paper",
  examClass: "Hifz 2",
  classId: "class-1",
  totalMarks: 20,
  duration: 60,
  instructions: "Answer all questions.",
};

const mcq: Question = {
  id: "q-mcq",
  categoryIds: ["fiqh"],
  type: "mcq",
  difficulty: "easy",
  questionLanguage: "en",
  text: "What is the capital of Egypt?",
  options: ["Cairo", "Giza"],
  answer: "Cairo",
};

const short: Question = {
  id: "q-short",
  categoryIds: ["fiqh"],
  type: "short",
  difficulty: "easy",
  questionLanguage: "ar",
  text: "ما هو الوضوء؟",
  options: [],
  answer: "طهارة",
};

const sections: PaperSection[] = [
  { id: "s-1", title: "Section 1", instructions: "", questionIds: [mcq.id, short.id] },
];
const questionsById = new Map<string, Question>([
  [mcq.id, mcq],
  [short.id, short],
]);

describe("PrintablePaper", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders the paper without the answer key or answer text", () => {
    act(() => {
      root.render(
        <PrintablePaper config={config} sections={sections} questionsById={questionsById} />,
      );
    });

    // Options are choices, not the key: the answer block and highlight must be absent.
    expect(container.querySelectorAll(".qpaper-answer")).toHaveLength(0);
    expect(container.querySelectorAll(".qpaper-option-correct")).toHaveLength(0);
    expect(container.textContent).not.toContain("طهارة");
    expect(container.textContent).toContain("What is the capital of Egypt?");
    expect(container.querySelectorAll(".qpaper-line").length).toBeGreaterThan(0);
    expect(container.querySelectorAll("bdi").length).toBeGreaterThan(0);
  });

  it("renders the answer key with the correct option highlighted", () => {
    act(() => {
      root.render(
        <PrintablePaper
          config={config}
          sections={sections}
          questionsById={questionsById}
          mode="answerKey"
        />,
      );
    });

    expect(container.textContent).toContain("questionBank.answerKey");
    expect(container.textContent).toContain("Cairo");
    expect(container.querySelectorAll(".qpaper-option-correct").length).toBe(1);
    expect(container.querySelectorAll(".qpaper-line")).toHaveLength(0);
  });

  it("renders one bubble per option for an answer sheet", () => {
    act(() => {
      root.render(
        <PrintableAnswerSheet config={config} sections={sections} questionsById={questionsById} />,
      );
    });

    expect(container.querySelectorAll(".qpaper-sheet-cell")).toHaveLength(2);
    // Two questions: the mcq has 2 options, the short answer uses the two-bubble floor.
    expect(container.querySelectorAll(".qpaper-bubble").length).toBe(4);
    expect(container.textContent).toContain("questionBank.answerSheetInstructions");
  });
});
