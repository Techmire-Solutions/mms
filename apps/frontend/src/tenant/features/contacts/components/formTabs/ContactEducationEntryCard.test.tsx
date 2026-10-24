import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactEducationEntryCard } from "./ContactEducationEntryCard";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("./ContactSubListCards", () => ({
  FormListFieldCard: ({
    children,
    typeSelect,
  }: {
    children: React.ReactNode;
    typeSelect?: React.ReactNode;
  }) => (
    <div data-testid="list-field-card">
      {typeSelect}
      {children}
    </div>
  ),
}));

vi.mock("@/components/app/FormPrimitives", () => ({
  TYPE_SELECT_WIDTH: "w-32",
  FormCardTypeSelect: ({
    label,
    children,
  }: {
    label: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div>
      <span>{label}</span>
      {children}
    </div>
  ),
  Field: ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div data-testid="field">
      <label>{label}</label>
      {children}
    </div>
  ),
  EditableSelect: ({ value }: { value?: string }) => (
    <div data-testid="editable-select">{value}</div>
  ),
  FormCheckboxCard: ({ label, checked }: { label: string; checked: boolean }) => (
    <div data-testid="checkbox-card">
      {label}: {checked ? "yes" : "no"}
    </div>
  ),
  FormListFieldCard: ({
    children,
    typeSelect,
  }: {
    children: React.ReactNode;
    typeSelect?: React.ReactNode;
  }) => (
    <div data-testid="list-field-card">
      <div>{typeSelect}</div>
      <div>{children}</div>
    </div>
  ),
}));

describe("ContactEducationEntryCard Component", () => {
  it("renders education card fields correctly", () => {
    const html = renderToStaticMarkup(
      <ContactEducationEntryCard
        edu={{
          degree: "Bachelor of Science",
          institution: "University of Karachi",
          fieldOfStudy: "Computer Science",
          year: "2020",
          grade: "A",
          isCurrentlyEnrolled: false,
        }}
        idx={0}
        formInstanceId="inst-edu-1"
        localId="loc-edu-1"
        degreeOptions={["Bachelor of Science", "Master of Science"]}
        showDegree={true}
        showInstitution={true}
        showFieldOfStudy={true}
        showYear={true}
        showGrade={true}
        isFieldRequired={() => false}
        getListItemError={() => undefined}
        onUpdateEducation={vi.fn()}
        onRemoveEducation={vi.fn()}
      />,
    );

    expect(html).toContain("University of Karachi");
    expect(html).toContain("Computer Science");
    expect(html).toContain("2020");
    expect(html).toContain("Bachelor of Science");
  });

  it("shows currently studying state when enrolled", () => {
    const html = renderToStaticMarkup(
      <ContactEducationEntryCard
        edu={{
          degree: "Master of Science",
          institution: "NED University",
          fieldOfStudy: "Data Science",
          year: "",
          grade: "",
          isCurrentlyEnrolled: true,
        }}
        idx={1}
        formInstanceId="inst-edu-1"
        localId="loc-edu-2"
        degreeOptions={["Master of Science"]}
        showDegree={true}
        showInstitution={true}
        showFieldOfStudy={true}
        showYear={true}
        showGrade={false}
        isFieldRequired={() => false}
        getListItemError={() => undefined}
        onUpdateEducation={vi.fn()}
        onRemoveEducation={vi.fn()}
      />,
    );

    expect(html).toContain("NED University");
    expect(html).toContain("contacts.form.currentlyStudying");
  });
});
