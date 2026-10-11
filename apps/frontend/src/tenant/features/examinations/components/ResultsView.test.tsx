import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ResultsView } from "./ResultsView";
import type { Exam } from "@/lib/data/examinationData";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("./useResultsViewData", () => ({
  useResultsViewData: () => ({
    exam: {
      id: "ex-1",
      name: "Tajweed Test",
      subject: "Tajweed",
      date: "2025-01-01",
      duration: 60,
      totalMarks: 100,
      passingMarks: 50,
      classIds: ["cls-1"],
      status: "completed",
    },
    rankedResults: [],
    stats: {
      average: 75,
      passed: 10,
      failed: 2,
      total: 12,
    },
  }),
}));

vi.mock("./ResultsViewStats", () => ({
  ResultsViewStats: () => <div data-testid="results-stats">Results Stats</div>,
}));

vi.mock("./ResultsViewRankingsList", () => ({
  ResultsViewRankingsList: () => <div data-testid="rankings-list">Rankings List</div>,
}));

const mockExams: Exam[] = [
  {
    id: "ex-1",
    name: "Tajweed Test",
    subject: "Tajweed",
    date: "2025-01-01",
    duration: 60,
    totalMarks: 100,
    passingMarks: 50,
    classIds: ["cls-1"],
    status: "completed",
    description: "",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
];

describe("ResultsView Component", () => {
  it("renders exam selector, stats and rankings list", () => {
    const html = renderToStaticMarkup(<ResultsView exams={mockExams} results={[]} />);

    expect(html).toContain("Tajweed Test");
    expect(html).toContain("Results Stats");
    expect(html).toContain("Rankings List");
  });
});
