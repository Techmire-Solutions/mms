import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ExaminationForm from "./ExaminationForm";
import type { Exam } from "@/lib/data/examinationData";

vi.mock("@/tenant/features/examinations/components/useExaminationForm", () => ({
  useExaminationForm: () => ({
    t: (key: string) => key,
    saving: false,
    valid: true,
    errors: {},
    examDraft: {
      name: "Midterm",
      subject: "Tajweed",
      totalMarks: 100,
      passingMarks: 50,
      date: "2025-01-01",
      duration: 60,
      classIds: ["cls-1"],
      status: "upcoming",
    },
    classes: [{ id: "cls-1", name: "Class 1" }],
    updateDraft: vi.fn(),
    handleSave: vi.fn(),
    getFieldError: () => undefined,
  }),
}));

vi.mock("@/components/ui/FormModal", () => ({
  FormModal: ({ children, title }: any) => (
    <div data-testid="form-modal">
      <h2>{title}</h2>
      {children}
    </div>
  ),
}));

vi.mock("./ExaminationFormFields", () => ({
  ExaminationFormFields: () => <div data-testid="form-fields">Form Fields</div>,
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

describe("ExaminationForm Component", () => {
  it("renders form modal with edit title when exam is provided", () => {
    const html = renderToStaticMarkup(
      <ExaminationForm open={true} exam={mockExam} onClose={vi.fn()} onSave={vi.fn()} />,
    );

    expect(html).toContain("examinations.form.title.edit");
    expect(html).toContain("Form Fields");
  });

  it("renders form modal with create title when exam is null", () => {
    const html = renderToStaticMarkup(
      <ExaminationForm open={true} exam={null} onClose={vi.fn()} onSave={vi.fn()} />,
    );

    expect(html).toContain("examinations.form.title.create");
  });
});
