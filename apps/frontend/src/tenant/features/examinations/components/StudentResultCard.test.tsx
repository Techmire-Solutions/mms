import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StudentResultCard, type StudentResultItem } from "./StudentResultCard";
import type { Exam } from "@/lib/data/examinationData";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/app/Modal", () => ({
  Modal: ({ children, title, subtitle, footer }: any) => (
    <div data-testid="modal">
      <h2>{title}</h2>
      <h3>{subtitle}</h3>
      {children}
      {footer}
    </div>
  ),
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
  status: "completed",
  description: "",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
};

const mockResult: StudentResultItem = {
  pct: 95,
  grade: {
    label: "A+",
    color: "#10b981",
    bg: "#ecfdf5",
    border: "#a7f3d0",
    tone: "success",
  },
  rank: 1,
  marksObtained: 95,
  passed: true,
  student: {
    name: "Zaid Khan",
    rollNo: "GR-001",
  },
  cls: {
    name: "Class 1A",
  },
};

describe("StudentResultCard Component", () => {
  it("renders student result card modal with score, rank, and details", () => {
    const html = renderToStaticMarkup(
      <StudentResultCard
        result={mockResult}
        exam={mockExam}
        allResults={[mockResult]}
        onClose={vi.fn()}
        onCertificate={vi.fn()}
      />,
    );

    expect(html).toContain("Zaid Khan");
    expect(html).toContain("Class 1A · GR-001");
    expect(html).toContain("95/100");
    expect(html).toContain("Tajweed Test");
    expect(html).toContain("examinations.resultCard.certificate");
  });
});
