import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CertificatePreview } from "./CertificatePreview";
import type { Exam } from "@/lib/data/examinationData";
import type { StudentResultItem } from "./StudentResultCard";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.name) return `${key}:${params.name}`;
      return key;
    },
  }),
}));

vi.mock("@/lib/contexts/BrandingPaletteContext", () => ({
  useBrandPalette: () => ({
    primary: "#10b981",
    secondary: "#f59e0b",
  }),
}));

vi.mock("@/components/app/Modal", () => ({
  Modal: ({
    children,
    title,
    headerActions,
  }: {
    children?: React.ReactNode;
    title?: React.ReactNode;
    headerActions?: React.ReactNode;
  }) => (
    <div data-testid="modal">
      <h2>{title}</h2>
      {headerActions}
      {children}
    </div>
  ),
}));

const mockExam: Exam = {
  id: "ex-1",
  name: "Tajweed Annual",
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

describe("CertificatePreview Component", () => {
  it("renders certificate layout with student details", () => {
    const html = renderToStaticMarkup(
      <CertificatePreview result={mockResult} exam={mockExam} onClose={vi.fn()} />,
    );

    expect(html).toContain("Zaid Khan");
    expect(html).toContain("Tajweed Annual");
    expect(html).toContain("examinations.certificatePreview.title");
    expect(html).toContain("examinations.certificatePreview.printDownload");
  });
});
