import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QuestionsListDesktopTable } from "./QuestionsListDesktopTable";
import type { QuestionBankQuestion } from "@mms/shared";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockConfig = {
  orderedFields: [],
  categories: [],
  sourceBooks: [],
  isFieldEnabled: () => true,
  fieldLabel: (_id: string, label: string) => label,
  questionLanguageLabel: (lang?: string) => lang || "en",
} as unknown as never;

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
  selectedIds: [],
  canWrite: true,
  canDelete: true,
  canTrashRows: true,
  showDeleted: false,
  isColumnVisible: () => true,
  allVisibleSelected: false,
  someVisibleSelected: false,
  getColumnWidth: () => undefined,
  onColumnResize: vi.fn(),
  onEditQuestion: vi.fn(),
  onTrashAction: vi.fn(),
  onToggleSelectedQuestion: vi.fn(),
  onToggleSelectAll: vi.fn(),
};

describe("QuestionsListDesktopTable", () => {
  it("renders table with question text and without hidden display classes", () => {
    const html = renderToStaticMarkup(<QuestionsListDesktopTable {...baseProps} />);
    expect(html).toContain("What is the pillar of prayer?");
    expect(html).toContain("<table");
    expect(html).not.toContain("hidden md:block");
  });
});
