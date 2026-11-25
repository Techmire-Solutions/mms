import { describe, expect, it } from "vitest";
import type { Exam, ExamResult } from "@/lib/data/examinationData";
import { collectStudentPapers, initialTermPaperSelection } from "./studentExamPapers";

function exam(overrides: Partial<Exam> & Pick<Exam, "id">): Exam {
  return {
    name: "Mid-Term",
    subject: "Quran",
    totalMarks: 100,
    passingMarks: 50,
    date: "2026-01-01",
    duration: 60,
    classIds: ["cls-1"],
    status: "completed",
    description: "",
    ...overrides,
  } as Exam;
}

function result(examId: string, studentId: string, marksObtained = 80): ExamResult {
  return { id: `r-${examId}-${studentId}`, examId, studentId, marksObtained } as ExamResult;
}

describe("collectStudentPapers", () => {
  it("keeps only the student's papers with results, sorted by date", () => {
    const papers = collectStudentPapers(
      [
        exam({ id: "ex-2", subject: "Tajweed", date: "2026-02-01" }),
        exam({ id: "ex-1", subject: "Quran", date: "2026-01-01" }),
        exam({ id: "ex-3", subject: "Fiqh", date: "2026-03-01" }),
      ],
      [
        result("ex-2", "student-1", 40),
        result("ex-1", "student-1", 90),
        result("ex-3", "student-2", 70),
      ],
      "student-1",
    );

    expect(papers.map((paper) => paper.exam.id)).toEqual(["ex-1", "ex-2"]);
    expect(papers[0]?.result.marksObtained).toBe(90);
  });

  it("drops cancelled and soft-deleted exams", () => {
    const papers = collectStudentPapers(
      [
        exam({ id: "ex-1" }),
        exam({ id: "ex-2", status: "cancelled" }),
        exam({ id: "ex-3", deletedAt: "2026-01-01T00:00:00.000Z" }),
      ],
      [result("ex-1", "s1"), result("ex-2", "s1"), result("ex-3", "s1")],
      "s1",
    );

    expect(papers.map((paper) => paper.exam.id)).toEqual(["ex-1"]);
  });

  it("returns no papers when the student has no results", () => {
    expect(collectStudentPapers([exam({ id: "ex-1" })], [result("ex-1", "other")], "s1")).toEqual(
      [],
    );
  });
});

describe("initialTermPaperSelection", () => {
  it("preselects the current term's papers within the same calendar year only", () => {
    const papers = collectStudentPapers(
      [
        exam({ id: "ex-2026-mid", name: "Mid-Term", date: "2026-01-10" }),
        exam({ id: "ex-2026-final", name: "Mid-Term", date: "2026-06-10" }),
        exam({ id: "ex-2025-mid", name: "Mid-Term", date: "2025-01-10" }),
        exam({ id: "ex-2026-other", name: "Final-Term", date: "2026-07-10" }),
      ],
      [
        result("ex-2026-mid", "s1"),
        result("ex-2026-final", "s1"),
        result("ex-2025-mid", "s1"),
        result("ex-2026-other", "s1"),
      ],
      "s1",
    );

    expect([...initialTermPaperSelection(papers, "ex-2026-mid")].sort()).toEqual(
      ["ex-2026-final", "ex-2026-mid"].sort(),
    );
  });

  it("returns an empty selection when the current exam is not among the papers", () => {
    expect(initialTermPaperSelection([], "missing")).toEqual(new Set());
  });
});
