import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ExaminationsRowActions } from "./ExaminationsRowActions";
import type { Exam } from "@mms/shared";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/app/ModuleRowActionsMenu", () => ({
  ModuleRowActionsMenu: ({ triggerLabel, editLabel, deleteLabel }: any) => (
    <div data-testid="row-actions-menu">
      <span>{triggerLabel}</span>
      <span>{editLabel}</span>
      <span>{deleteLabel}</span>
    </div>
  ),
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

describe("ExaminationsRowActions Component", () => {
  it("renders row actions menu", () => {
    const html = renderToStaticMarkup(
      <ExaminationsRowActions
        exam={mockExam}
        canWrite={true}
        canDelete={true}
        showDeleted={false}
        onEdit={vi.fn()}
        onTrashAction={vi.fn()}
      />,
    );

    expect(html).toContain("examinations.table.actions");
    expect(html).toContain("common.edit");
    expect(html).toContain("common.delete");
  });
});
