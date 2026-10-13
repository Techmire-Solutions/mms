import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ExaminationsModalLayer } from "./ExaminationsModalLayer";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("./ExaminationForm", () => ({
  default: () => <div data-testid="exam-form">Exam Form</div>,
}));

vi.mock("./EnterMarks", () => ({
  EnterMarks: () => <div data-testid="enter-marks">Enter Marks</div>,
}));

vi.mock("@/components/app/FormModal", () => ({
  FormModal: ({ children, title, open }: any) =>
    open ? (
      <div data-testid="form-modal">
        <h2>{title}</h2>
        {children}
      </div>
    ) : null,
}));

describe("ExaminationsModalLayer Component", () => {
  it("renders exam form when showExamForm is true and canWrite is true", () => {
    const html = renderToStaticMarkup(
      <ExaminationsModalLayer
        canWrite={true}
        showDeleted={false}
        showExamForm={true}
        showMarksModal={false}
        editExam={null}
        exams={[]}
        examResults={[]}
        onCloseExamForm={vi.fn()}
        onSaveExam={vi.fn()}
        onCloseMarks={vi.fn()}
        onSaveResults={vi.fn()}
      />,
    );

    expect(html).toContain("Exam Form");
    expect(html).not.toContain("Enter Marks");
  });

  it("renders marks modal when showMarksModal is true and canWrite is true", () => {
    const html = renderToStaticMarkup(
      <ExaminationsModalLayer
        canWrite={true}
        showDeleted={false}
        showExamForm={false}
        showMarksModal={true}
        editExam={null}
        exams={[]}
        examResults={[]}
        onCloseExamForm={vi.fn()}
        onSaveExam={vi.fn()}
        onCloseMarks={vi.fn()}
        onSaveResults={vi.fn()}
      />,
    );

    expect(html).toContain("Enter Marks");
    expect(html).toContain("examinations.marks");
  });
});
