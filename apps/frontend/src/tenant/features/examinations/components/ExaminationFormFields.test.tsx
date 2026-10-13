import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ExaminationFormFields } from "./ExaminationFormFields";

vi.mock("@/components/app/SectionCard", () => ({
  SectionCard: ({ children, title }: any) => (
    <div data-testid="section-card">
      <h3>{title}</h3>
      {children}
    </div>
  ),
}));

vi.mock("@/components/app/FormPrimitives", () => ({
  Field: ({ children, label }: any) => (
    <div>
      <label>{label}</label>
      {children}
    </div>
  ),
}));

vi.mock("@/components/app/FormSelect", () => ({
  FormSelect: ({ options, value }: any) => (
    <select data-testid="form-select" defaultValue={value}>
      {options.map((o: any) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock("@/components/app/DatePicker", () => ({
  DatePicker: ({ value }: any) => <input data-testid="date-picker" defaultValue={value} />,
}));

describe("ExaminationFormFields Component", () => {
  it("renders exam input fields and assigned classes", () => {
    const html = renderToStaticMarkup(
      <ExaminationFormFields
        t={((key: string) => key) as any}
        errors={{}}
        examDraft={{
          name: "Annual Exam",
          subject: "Hifz",
          totalMarks: 100,
          passingMarks: 50,
          duration: 90,
          date: "2025-01-01",
          classIds: ["cls-1"],
          description: "Details here",
          status: "upcoming",
        }}
        classes={[{ id: "cls-1", name: "Class 1" }]}
        updateDraft={vi.fn()}
        getFieldError={() => undefined}
      />,
    );

    expect(html).toContain("Annual Exam");
    expect(html).toContain("Class 1");
    expect(html).toContain("examinations.form.section.parameters");
  });
});
