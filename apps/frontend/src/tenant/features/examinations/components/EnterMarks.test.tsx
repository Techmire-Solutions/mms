import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EnterMarks } from "./EnterMarks";
import type { Exam, ExamResult } from "@/lib/data/examinationData";

vi.mock("@/hooks/useAcademicTerms", () => ({
  useAcademicTerms: () => ({
    session: { singular: "Session", plural: "Sessions" },
    class: { singular: "Class", plural: "Classes" },
    section: { singular: "Section", plural: "Sections" },
  }),
}));
vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
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
  ],
}));

vi.mock("@/tenant/hooks/collections/students", () => ({
  useStudentsByIds: () => ({
    data: [
      {
        id: "std-1",
        name: "Ali Raza",
        grNumber: "GR-100",
      },
    ],
  }),
}));

vi.mock("@/components/app/UserAvatar", () => ({
  UserAvatar: ({ name }: { name?: React.ReactNode }) => <div data-testid="avatar">{name}</div>,
}));

const mockExam: Exam = {
  id: "ex-1",
  name: "Tajweed Test",
  subject: "Tajweed",
  date: "2025-01-01",
  duration: 60,
  totalMarks: 100,
  passingMarks: 50,
  classIds: ["cls-1"],
  status: "upcoming",
  description: "",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
};

const mockResults: ExamResult[] = [
  {
    id: "er_ex-1_std-1",
    examId: "ex-1",
    studentId: "std-1",
    marksObtained: 85,
  },
];

describe("EnterMarks Component", () => {
  it("renders exam radio selection and students marks inputs", () => {
    const html = renderToStaticMarkup(
      <EnterMarks exams={[mockExam]} results={mockResults} onSaveResults={vi.fn()} />,
    );

    expect(html).toContain("Tajweed Test");
    expect(html).toContain("Ali Raza");
    expect(html).toContain("examinations.enterMarks.save");
  });
});
