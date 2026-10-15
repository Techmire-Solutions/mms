import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ResultsViewRankingsList } from "./ResultsViewRankingsList";
import type { Exam } from "@/lib/data/examinationData";
import type { RankedResult } from "../lib/resultsViewTypes";

const mockExam: Exam = {
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
};

const mockRankedResult: RankedResult = {
  id: "r-1",
  examId: "ex-1",
  studentId: "std-1",
  marksObtained: 95,
  pct: 95,
  grade: {
    label: "A+",
    color: "#10b981",
    bg: "#ecfdf5",
    border: "#a7f3d0",
    tone: "success",
  },
  rank: 1,
  passed: true,
  student: {
    name: "Zaid Khan",
    rollNo: "GR-001",
  },
  cls: {
    name: "Class 1A",
  },
};

describe("ResultsViewRankingsList Component", () => {
  it("renders rankings list items with rank medals and details", () => {
    const html = renderToStaticMarkup(
      <ResultsViewRankingsList
        exam={mockExam}
        rankedResults={[mockRankedResult]}
        passFailConfig={{}}
        isColumnVisible={() => true}
        onSelectResult={vi.fn()}
        onCertificate={vi.fn()}
        t={((key: string) => key) as unknown as never}
      />,
    );

    expect(html).toContain("Zaid Khan");
    expect(html).toContain("Class 1A");
    expect(html).toContain("95");
  });
});
