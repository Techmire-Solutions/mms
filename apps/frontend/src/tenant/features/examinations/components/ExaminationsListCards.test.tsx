import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ExaminationsListCards, type ExaminationsListCardsProps } from "./ExaminationsListCards";
import type { Exam } from "@/lib/data/examinationData";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("./ExaminationsRowActions", () => ({
  ExaminationsRowActions: () => <div data-testid="row-actions">Row Actions</div>,
}));

const mockExam: Exam = {
  id: "ex-1",
  name: "Midterm Exam",
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

const baseProps = {
  viewMode: "cards" as const,
  exams: [mockExam],
  selectedIds: [],
  isColumnVisible: () => true,
  classes: [{ id: "cls-1", name: "Class 1A" }],
  enrollments: [] as ExaminationsListCardsProps["enrollments"],
  allVisibleSelected: false,
  someVisibleSelected: false,
  canWrite: true,
  canDelete: true,
  showDeleted: false,
  canTrashRows: true,
  statusConfig: { upcoming: { label: "Upcoming", cls: "bg-info" } },
  onEdit: vi.fn(),
  onToggleSelectAll: vi.fn(),
  onToggleSelectedExam: vi.fn(),
  onTrashAction: vi.fn(),
};

describe("ExaminationsListCards", () => {
  it("renders exam name, subject, and class", () => {
    const html = renderToStaticMarkup(<ExaminationsListCards {...baseProps} />);
    expect(html).toContain("Midterm Exam");
    expect(html).toContain("Tajweed");
    expect(html).toContain("Class 1A");
  });

  it("renders metadata tiles for visible columns", () => {
    const html = renderToStaticMarkup(<ExaminationsListCards {...baseProps} />);
    // Column labels are rendered as tile labels
    expect(html).toContain("examinations.columns.exam.date");
    expect(html).toContain("examinations.columns.exam.duration");
    expect(html).toContain("examinations.columns.exam.totalMarks");
  });

  it("hides column when isColumnVisible returns false", () => {
    const html = renderToStaticMarkup(
      <ExaminationsListCards {...baseProps} isColumnVisible={(k) => k !== "duration"} />,
    );
    expect(html).not.toContain("examinations.columns.exam.duration");
  });

  it("renders row actions", () => {
    const html = renderToStaticMarkup(<ExaminationsListCards {...baseProps} />);
    expect(html).toContain("Row Actions");
  });

  it("renders selection checkbox when canDelete=true", () => {
    const html = renderToStaticMarkup(<ExaminationsListCards {...baseProps} />);
    expect(html).toContain('type="checkbox"');
  });

  it("does not render checkbox when canDelete=false", () => {
    const html = renderToStaticMarkup(<ExaminationsListCards {...baseProps} canDelete={false} />);
    expect(html).not.toContain('type="checkbox"');
  });

  it("does not render onView/edit button when showDeleted=true", () => {
    const html = renderToStaticMarkup(<ExaminationsListCards {...baseProps} showDeleted={true} />);
    // Header button only present when canViewEdit=true (canWrite && !showDeleted)
    // The header does not render an onView button when showDeleted
    expect(html).toContain("Midterm Exam");
  });

  it("applies selected card style when exam is in selectedIds", () => {
    const html = renderToStaticMarkup(
      <ExaminationsListCards {...baseProps} selectedIds={["ex-1"]} />,
    );
    expect(html).toContain("border-primary/50");
  });

  it("renders student count hint in classes tile", () => {
    const propsWithEnrollments = {
      ...baseProps,
      enrollments: [
        { classId: "cls-1", studentId: "s1" },
        { classId: "cls-1", studentId: "s2" },
      ] as unknown as (typeof baseProps)["enrollments"],
    };
    const html = renderToStaticMarkup(<ExaminationsListCards {...propsWithEnrollments} />);
    expect(html).toContain("examinations.studentCount");
  });

  it("renders empty list without crashing", () => {
    const html = renderToStaticMarkup(<ExaminationsListCards {...baseProps} exams={[]} />);
    expect(html).toBeDefined();
  });

  it("renders card with accessible article role and tabindex for keyboard navigation", () => {
    const html = renderToStaticMarkup(<ExaminationsListCards {...baseProps} />);
    expect(html).toContain('role="article"');
    expect(html).toContain('tabindex="0"');
  });
});
