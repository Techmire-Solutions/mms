import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactEducationTab } from "./ContactEducationTab";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("./ContactSubListCards", () => ({
  ContactSubListShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sublist-shell">{children}</div>
  ),
  FormListFieldCard: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="list-field-card">{children}</div>
  ),
  resolveSubListAllowAdd: () => true,
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

describe("ContactEducationTab Component", () => {
  it("renders education entry fields", () => {
    const html = renderToStaticMarkup(
      <ContactEducationTab
        contactDraft={{
          education: [
            {
              degree: "BS CS",
              institution: "FAST",
              fieldOfStudy: "Computer Science",
              year: "2020",
              grade: "A",
            },
          ],
        }}
        getLocalId={() => "loc-1"}
        degreeOptions={["BS CS", "MS CS"]}
        formInstanceId="inst-1"
        getListItemError={() => undefined}
        isFieldEnabled={() => true}
        isFieldRequired={() => false}
        fields={{}}
        addSubListItem={vi.fn()}
        ensureSubListItem={vi.fn()}
        updateSubListItem={vi.fn()}
        removeSubListItem={vi.fn()}
      />,
    );

    expect(html).toContain("FAST");
    expect(html).toContain("Computer Science");
  });
});
