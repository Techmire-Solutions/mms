import { describe, expect, it } from "vitest";
import { buildReportCardPayload } from "./reportCardPayload";

const result = {
  pct: 95.4,
  marksObtained: 95,
  grade: { label: "A+" },
  student: { name: "Fatima Al-Zahra", rollNo: "EX-1092" },
  cls: { name: "Advanced Tajweed" },
};

const exam = {
  name: "Mid-Term Tajweed",
  subject: "Tajweed Rules",
  totalMarks: 100,
  date: "2026-03-15",
};

describe("buildReportCardPayload", () => {
  it("builds a single-subject report card from an exam result", () => {
    const payload = buildReportCardPayload({ result, exam, institution: "Madrasa Al-Huda" });

    expect(payload).toMatchObject({
      institution: "Madrasa Al-Huda",
      studentName: "Fatima Al-Zahra",
      rollNumber: "EX-1092",
      className: "Advanced Tajweed",
      term: "Mid-Term Tajweed",
      academicYear: "2026",
      totalMarks: 100,
      obtainedMarks: 95,
      percentage: "95%",
      grade: "A+",
      attendance: "",
      remarks: "",
    });
    expect(payload.subjects).toEqual([
      { name: "Tajweed Rules", maxMarks: 100, obtainedMarks: 95, grade: "A+", remarks: "" },
    ]);
  });

  it("falls back to the exam name when the subject is blank", () => {
    const payload = buildReportCardPayload({
      result,
      exam: { ...exam, subject: "" },
      institution: "Madrasa",
    });

    expect(payload.subjects[0]?.name).toBe("Mid-Term Tajweed");
  });

  it("tolerates a result without student/class records", () => {
    const payload = buildReportCardPayload({
      result: { pct: 50, marksObtained: 50, grade: { label: "D" } },
      exam,
      institution: "Madrasa",
    });

    expect(payload.studentName).toBe("");
    expect(payload.className).toBe("");
    expect(payload.percentage).toBe("50%");
  });
});
