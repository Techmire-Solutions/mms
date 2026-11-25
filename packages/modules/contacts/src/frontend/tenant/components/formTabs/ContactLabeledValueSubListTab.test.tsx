import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Mail } from "lucide-react";
import { ContactLabeledValueSubListTab } from "./ContactLabeledValueSubListTab.js";

vi.mock("@mms/fe-core/i18n", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@mms/fe-core/components/FormPrimitives", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
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
    id,
    children,
    typeSelect,
  }: {
    id?: string;
    children: React.ReactNode;
    typeSelect?: React.ReactNode;
  }) => (
    <div data-testid="list-field-card" data-card-id={id}>
      <div>{typeSelect}</div>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock("./ContactSubListCards.js", () => ({
  ContactSubListShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sublist-shell">{children}</div>
  ),
  FormListFieldCard: ({
    id,
    children,
    typeSelect,
  }: {
    id?: string;
    children: React.ReactNode;
    typeSelect?: React.ReactNode;
  }) => (
    <div data-testid="list-field-card" data-card-id={id}>
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

  it("uses stable item id as card id and React key to prevent input focus loss", () => {
    const html = renderToStaticMarkup(
      <ContactLabeledValueSubListTab
        contactDraft={{
          phones: [
            { id: "stable-phone-id-1", number: "1234567890", label: "mobile" },
            { id: "stable-phone-id-2", number: "0987654321", label: "work" },
          ],
        }}
        getLocalId={(_k, idx) => `fallback-${idx}`}
        listKey="phones"
        labelFieldKey="label"
        valueFieldKey="number"
        options={["mobile", "work"]}
        onUpdateOptions={vi.fn()}
        resolveLabel={(raw) => String(raw || "mobile")}
        emptyItem={(label) => ({ id: "gen-id", label, number: "" })}
        icon={Mail}
        emptyMessage="No phones"
        addLabel="Add Phone"
        removeLabel={(idx) => `Remove Phone ${idx}`}
        valuePlaceholder="Phone number"
        valueInputIdPrefix="phone-input"
        labelSelectIdPrefix="phone-label"
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

    expect(html).toContain('data-card-id="stable-phone-id-1"');
    expect(html).toContain('data-card-id="stable-phone-id-2"');
    expect(html).not.toContain('data-card-id="fallback-0"');
    expect(html).not.toContain('data-card-id="fallback-1"');
  });
});
