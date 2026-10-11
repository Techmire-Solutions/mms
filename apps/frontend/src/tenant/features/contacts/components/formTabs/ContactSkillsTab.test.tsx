import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactSkillsTab } from "./ContactSkillsTab";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("./ContactSubListCards", () => ({
  ContactSubListShell: ({
    children,
    isEmpty,
    emptyMessage,
  }: {
    children: React.ReactNode;
    isEmpty?: boolean;
    emptyMessage?: React.ReactNode;
  }) => <div data-testid="sublist-shell">{isEmpty ? <div>{emptyMessage}</div> : children}</div>,
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
  resolveSubListAllowAdd: () => true,
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

vi.mock("@/components/ui/textarea", () => ({
  Textarea: ({ value }: { value?: string }) => (
    <textarea data-testid="textarea" value={value || ""} readOnly />
  ),
}));

describe("ContactSkillsTab Component", () => {
  it("renders skills sublist", () => {
    const html = renderToStaticMarkup(
      <ContactSkillsTab
        contactDraft={{
          skills: [
            {
              name: "Arabic Grammar",
              category: "Language",
              proficiency: "Expert",
              yearsOfExperience: "5",
              isCertified: true,
              issuer: "Al-Azhar",
            },
          ],
        }}
        getLocalId={() => "loc-1"}
        categoryOptions={["Language", "Technical"]}
        proficiencyOptions={["Beginner", "Expert"]}
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

    expect(html).toContain("Arabic Grammar");
    expect(html).toContain("Language");
    expect(html).toContain("Al-Azhar");
  });

  it("renders empty state message when skills list is empty", () => {
    const html = renderToStaticMarkup(
      <ContactSkillsTab
        contactDraft={{ skills: [] }}
        getLocalId={() => "loc-1"}
        categoryOptions={["Language"]}
        proficiencyOptions={["Beginner"]}
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

    expect(html).toContain("contacts.form.noSkillsYet");
  });
});
