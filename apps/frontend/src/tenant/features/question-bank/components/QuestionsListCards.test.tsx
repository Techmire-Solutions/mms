import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QuestionsListCards } from "./QuestionsListCards";
import type { QuestionBankQuestion } from "@mms/shared";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => false,
}));

const mockConfig = {
  orderedFields: [],
  sourceBooks: [],
  isFieldEnabled: () => true,
  fieldLabel: (_id: string, label: string) => label,
} as any;

const baseProps = {
  questions: [
    {
      id: "q-1",
      text: "What is the pillar of prayer?",
      type: "mcq",
      difficulty: "medium",
      options: ["Niyyah", "Reading book", "Walking"],
      answer: "Niyyah",
      points: 2,
    } as unknown as QuestionBankQuestion,
  ],
  config: mockConfig,
  difficultyConfig: {},
  typeConfig: {},
  listMetaFields: [],
  selectedIds: [],
  allVisibleSelected: false,
  someVisibleSelected: false,
  canWrite: true,
  canDelete: true,
  canTrashRows: true,
  showDeleted: false,
  showSourceCitation: false,
  isColumnVisible: () => true,
  onToggleSelectAll: vi.fn(),
  onEditQuestion: vi.fn(),
  onTrashAction: vi.fn(),
  onToggleSelected: vi.fn(),
};

describe("QuestionsListCards", () => {
  it("renders question text and options", () => {
    const html = renderToStaticMarkup(<QuestionsListCards {...baseProps} />);
    expect(html).toContain("What is the pillar of prayer?");
    expect(html).toContain("Niyyah");
  });

  it("renders select checkbox when canDelete=true", () => {
    const html = renderToStaticMarkup(<QuestionsListCards {...baseProps} />);
    expect(html).toContain('type="checkbox"');
  });

  it("does not render checkbox when canDelete=false", () => {
    const html = renderToStaticMarkup(<QuestionsListCards {...baseProps} canDelete={false} />);
    expect(html).not.toContain('type="checkbox"');
  });

  it("applies selected styles when question is in selectedIds", () => {
    const html = renderToStaticMarkup(<QuestionsListCards {...baseProps} selectedIds={["q-1"]} />);
    expect(html).toContain("border-primary/50");
  });

  it("renders empty list without crashing", () => {
    const html = renderToStaticMarkup(<QuestionsListCards {...baseProps} questions={[]} />);
    expect(html).toBeDefined();
  });
});
