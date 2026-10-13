import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ExaminationDetail } from "./ExaminationDetail";
import type { Exam } from "@/lib/data/examinationData";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/app/Drawer", () => ({
  Drawer: ({ children, title }: any) => (
    <div data-testid="detail-drawer">
      <h2>{title}</h2>
      {children}
    </div>
  ),
}));

vi.mock("@/components/app/DetailDrawerArchiveChrome", () => ({
  DetailDrawerArchivedBanner: () => <div data-testid="archived-banner" />,
  DetailDrawerRestoreOrEditAction: () => <div data-testid="drawer-actions" />,
}));

const mockExam: Exam = {
  id: "ex-1",
  name: "Final Examination",
  subject: "Quran Recitation",
  date: "2025-01-01",
  duration: 90,
  totalMarks: 100,
  passingMarks: 60,
  classIds: ["cls-1"],
  status: "upcoming",
  description: "Comprehensive exam on Tajweed rules.",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
};

describe("ExaminationDetail Component", () => {
  it("renders exam details including title and description", () => {
    const html = renderToStaticMarkup(<ExaminationDetail exam={mockExam} onClose={vi.fn()} />);

    expect(html).toContain("Final Examination");
    expect(html).toContain("Comprehensive exam on Tajweed rules.");
  });
});
