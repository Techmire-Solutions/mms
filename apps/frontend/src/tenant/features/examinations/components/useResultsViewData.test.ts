import { describe, expect, it, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useResultsViewData } from "../hooks/useResultsViewData";
import type { Exam, ExamResult } from "@/lib/data/examinationData";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/hooks/collections/students", () => ({
  useStudentsByIds: () => ({
    data: [
      { id: "std-1", name: "Zaid", grNumber: "GR-001" },
      { id: "std-2", name: "Amir", grNumber: "GR-002" },
    ],
  }),
}));

vi.mock("@/tenant/hooks/collections/sessions", () => ({
  useSessionsCollection: () => [
    {
      id: "ses-1",
      name: "Session 2025",
      classes: [{ id: "cls-1", name: "Grade 1" }],
    },
  ],
}));

vi.mock("@/tenant/hooks/collections/enrollments", () => ({
  useEnrollmentsCollection: () => [
    {
      id: "enr-1",
      studentId: "std-1",
      classId: "cls-1",
      sessionId: "ses-1",
      status: "active",
      enrollmentDate: "2025-01-01",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    },
    {
      id: "enr-2",
      studentId: "std-2",
      classId: "cls-1",
      sessionId: "ses-1",
      status: "active",
      enrollmentDate: "2025-01-01",
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    },
  ],
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

const mockResults: ExamResult[] = [
  { id: "r-1", examId: "ex-1", studentId: "std-1", marksObtained: 90 },
  { id: "r-2", examId: "ex-1", studentId: "std-2", marksObtained: 40 },
];

describe("useResultsViewData Hook", () => {
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    return () => {
      if (container) {
        container.remove();
        container = null;
      }
    };
  });

  it("calculates ranked results and stats correctly", async () => {
    let hookResult: any;

    function TestComponent() {
      hookResult = useResultsViewData({
        exams: mockExams,
        results: mockResults,
        selectedExam: "ex-1",
      });
      return null;
    }

    const root = createRoot(container!);
    await act(async () => {
      root.render(React.createElement(TestComponent));
    });

    expect(hookResult.rankedResults).toHaveLength(2);
    expect(hookResult.rankedResults[0].rank).toBe(1);
    expect(hookResult.rankedResults[0].marksObtained).toBe(90);
    expect(hookResult.rankedResults[0].passed).toBe(true);

    expect(hookResult.rankedResults[1].rank).toBe(2);
    expect(hookResult.rankedResults[1].marksObtained).toBe(40);
    expect(hookResult.rankedResults[1].passed).toBe(false);

    expect(hookResult.stats).toEqual({
      average: 65,
      passed: 1,
      failed: 1,
      total: 2,
    });
  });
});
