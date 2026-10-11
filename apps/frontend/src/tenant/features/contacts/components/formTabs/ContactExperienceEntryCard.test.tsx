import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactExperienceEntryCard } from "./ContactExperienceEntryCard";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("./ContactSubListCards", () => ({
  FormListFieldCard: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="list-field-card">{children}</div>
  ),
}));

vi.mock("@/components/ui/DatePicker", () => ({
  DatePicker: ({ value }: { value?: string }) => <div data-testid="datepicker">{value}</div>,
}));

vi.mock("@/components/ui/textarea", () => ({
  Textarea: ({ value }: { value?: string }) => (
    <textarea data-testid="textarea" value={value || ""} readOnly />
  ),
}));

vi.mock("@/components/ui/FormPrimitives", () => ({
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

describe("ContactExperienceEntryCard Component", () => {
  it("renders experience card fields", () => {
    const html = renderToStaticMarkup(
      <ContactExperienceEntryCard
        exp={{
          title: "Senior Lead",
          organization: "Tech Systems",
          employmentType: "Full-time",
          location: "Karachi",
          startDate: "2021-01-01",
          isCurrent: true,
          description: "Leading frontend engineers",
        }}
        idx={0}
        formInstanceId="inst-1"
        getLocalId={() => "loc-1"}
        getListItemError={() => undefined}
        isFieldRequired={() => false}
        showTitle={true}
        showOrganization={true}
        showEmploymentType={true}
        showLocation={true}
        showStartDate={true}
        showEndDate={true}
        showIsCurrent={true}
        showDescription={true}
        employmentTypeOptions={["Full-time", "Part-time"]}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(html).toContain("Senior Lead");
    expect(html).toContain("Tech Systems");
    expect(html).toContain("Karachi");
    expect(html).toContain("Leading frontend engineers");
  });
});
