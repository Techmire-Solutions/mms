import { describe, expect, it } from "vitest";
import { buildReportCardPayload, buildTermReportCardPayload } from "./reportCardPayload";

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

describe("buildTermReportCardPayload", () => {
  const result = {
    pct: 87,
    marksObtained: 130,
    grade: { label: "A" },
    student: { name: "Fatima Al-Zahra", rollNo: "EX-1092" },
    cls: { name: "Advanced Tajweed" },
  };

  const papers = [
    {
      exam: { name: "Mid-Term", subject: "Quran", totalMarks: 100, date: "2026-01-01" },
      result: { marksObtained: 90 },
    },
    {
      exam: { name: "Mid-Term", subject: "Tajweed", totalMarks: 50, date: "2026-01-02" },
      result: { marksObtained: 40 },
    },
  ];

  it("aggregates selected papers into weighted totals and one row per subject", () => {
    const payload = buildTermReportCardPayload({
      result,
      papers,
      institution: "Madrasa Al-Huda",
      mixedTermLabel: "Multiple exams",
    });

    expect(payload.subjects).toEqual([
      { name: "Quran", maxMarks: 100, obtainedMarks: 90, grade: "A+", remarks: "" },
      { name: "Tajweed", maxMarks: 50, obtainedMarks: 40, grade: "A", remarks: "" },
    ]);
    expect(payload.totalMarks).toBe(150);
    expect(payload.obtainedMarks).toBe(130);
    expect(payload.percentage).toBe("87%");
    expect(payload.grade).toBe("A");
    expect(payload.term).toBe("Mid-Term");
    expect(payload.academicYear).toBe("2026");
    expect(payload.className).toBe("Advanced Tajweed");
  });

  it("labels a mixed-term selection and a year range", () => {
    const payload = buildTermReportCardPayload({
      result,
      papers: [
        papers[0]!,
        {
          exam: { name: "Final-Term", subject: "Fiqh", totalMarks: 100, date: "2027-02-01" },
          result: { marksObtained: 70 },
        },
      ],
      institution: "Madrasa",
      mixedTermLabel: "Multiple exams",
    });

    expect(payload.term).toBe("Multiple exams");
    expect(payload.academicYear).toBe("2026–2027");
  });

  it("produces a zeroed card when no papers are selected", () => {
    const payload = buildTermReportCardPayload({
      result,
      papers: [],
      institution: "Madrasa",
      mixedTermLabel: "Multiple exams",
    });

    expect(payload.subjects).toEqual([]);
    expect(payload.totalMarks).toBe(0);
    expect(payload.obtainedMarks).toBe(0);
    expect(payload.percentage).toBe("0%");
    expect(payload.grade).toBe("F");
  });
});
