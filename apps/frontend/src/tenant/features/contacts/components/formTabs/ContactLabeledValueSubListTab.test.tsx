import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Mail } from "lucide-react";
import { ContactLabeledValueSubListTab } from "./ContactLabeledValueSubListTab";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
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

vi.mock("./ContactSubListCards", () => ({
  ContactSubListShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sublist-shell">{children}</div>
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
  resolveSubListAllowAdd: () => true,
}));

describe("ContactLabeledValueSubListTab Component", () => {
  it("renders list items correctly", () => {
    const html = renderToStaticMarkup(
      <ContactLabeledValueSubListTab
        contactDraft={{
          emails: [{ address: "test@example.com", label: "work" }],
        }}
        getLocalId={() => "local-1"}
        listKey="emails"
        labelFieldKey="label"
        valueFieldKey="address"
        options={["personal", "work"]}
        onUpdateOptions={vi.fn()}
        resolveLabel={(raw) => String(raw || "personal")}
        emptyItem={(label) => ({ label, address: "" })}
        icon={Mail}
        emptyMessage="No emails"
        addLabel="Add Email"
        removeLabel={(idx) => `Remove Email ${idx}`}
        valuePlaceholder="Email address"
        valueInputIdPrefix="email-input"
        labelSelectIdPrefix="email-label"
        getListItemError={() => undefined}
        isFieldEnabled={() => true}
        isFieldRequired={() => false}
        fields={{}}
        formInstanceId="inst-1"
        addSubListItem={vi.fn()}
        ensureSubListItem={vi.fn()}
        updateSubListItem={vi.fn()}
        removeSubListItem={vi.fn()}
      />,
    );

    expect(html).toContain("test@example.com");
  });
});
