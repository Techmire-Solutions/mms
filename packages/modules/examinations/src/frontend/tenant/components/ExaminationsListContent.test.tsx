import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ExaminationsListContent } from "./ExaminationsListContent";
import type { Exam } from "@mms/contracts";

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("./ExaminationsListCards", () => ({
  ExaminationsListCards: () => <div data-testid="exams-cards">Cards View</div>,
}));

vi.mock("./ExaminationsListDesktopTable", () => ({
  ExaminationsListDesktopTable: () => <div data-testid="exams-table">Table View</div>,
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

describe("ExaminationsListContent Component", () => {
  it("renders empty state when exams list is empty", () => {
    const html = renderToStaticMarkup(
      <ExaminationsListContent
        viewMode="table"
        exams={[]}
        selectedIds={[]}
        isColumnVisible={() => true}
        classes={[]}
        enrollments={[]}
        allVisibleSelected={false}
        someVisibleSelected={false}
        canWrite={true}
        canDelete={true}
        showDeleted={false}
        canTrashRows={true}
        statusConfig={{}}
        onEdit={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onToggleSelectedExam={vi.fn()}
        onTrashAction={vi.fn()}
      />,
    );

    expect(html).toContain("examinations.empty.exams");
  });

  it("renders cards view when viewMode is cards", () => {
    const html = renderToStaticMarkup(
      <ExaminationsListContent
        viewMode="cards"
        exams={[mockExam]}
        selectedIds={[]}
        isColumnVisible={() => true}
        classes={[]}
        enrollments={[]}
        allVisibleSelected={false}
        someVisibleSelected={false}
        canWrite={true}
        canDelete={true}
        showDeleted={false}
        canTrashRows={true}
        statusConfig={{}}
        onEdit={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onToggleSelectedExam={vi.fn()}
        onTrashAction={vi.fn()}
      />,
    );

    expect(html).toContain("Cards View");
  });

  it("renders table view when viewMode is table", () => {
    const html = renderToStaticMarkup(
      <ExaminationsListContent
        viewMode="table"
        exams={[mockExam]}
        selectedIds={[]}
        isColumnVisible={() => true}
        classes={[]}
        enrollments={[]}
        allVisibleSelected={false}
        someVisibleSelected={false}
        canWrite={true}
        canDelete={true}
        showDeleted={false}
        canTrashRows={true}
        statusConfig={{}}
        onEdit={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onToggleSelectedExam={vi.fn()}
        onTrashAction={vi.fn()}
      />,
    );

    expect(html).toContain("Table View");
  });
});
