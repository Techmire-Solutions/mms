import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactRelationshipTab, STATIC_RELATIONSHIP_OPTIONS } from "./ContactRelationshipTab";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
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
  FormSelect: ({
    value,
    options,
    id,
    name,
  }: {
    value?: string;
    options: readonly ({ value: string; label: string } | string)[];
    id?: string;
    name?: string;
  }) => (
    <select data-testid="form-select" data-value={value} id={id} name={name}>
      {options.map((opt) => {
        const val = typeof opt === "string" ? opt : opt.value;
        const lbl = typeof opt === "string" ? opt : opt.label;
        return (
          <option key={val} value={val}>
            {lbl}
          </option>
        );
      })}
    </select>
  ),
  EditableSelect: ({ value }: { value?: string }) => (
    <div data-testid="editable-select">{value}</div>
  ),
  FieldErrorMessage: () => null,
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

let capturedPickerProps: {
  label: string;
  onChange: (id: string | number | null, contact?: unknown) => void;
} | null = null;

vi.mock("@/components/contactLink/ContactPicker", () => ({
  default: (props: {
    label: string;
    onChange: (id: string | number | null, contact?: unknown) => void;
  }) => {
    capturedPickerProps = props;
    return <div data-testid="contact-picker">{props.label}</div>;
  },
}));

describe("ContactRelationshipTab Component", () => {
  it("exports strictly 6 hardcoded relationship options matching relationship pairs", () => {
    expect(STATIC_RELATIONSHIP_OPTIONS).toEqual([
      "Parent",
      "Child",
      "Husband",
      "Wife",
      "Guardian",
      "Dependent",
    ]);
  });

  it("renders relationships sublist with FormSelect and hardcoded options", () => {
    const html = renderToStaticMarkup(
      <ContactRelationshipTab
        contactDraft={{
          relationshipContacts: [{ contactId: "cnt-2", relationship: "Brother" }],
        }}
        formInstanceId="inst-1"
        getLocalId={() => "loc-1"}
        isFieldEnabled={() => true}
        isFieldRequired={() => false}
        getListItemError={() => undefined}
        fields={{}}
        addSubListItem={vi.fn()}
        ensureSubListItem={vi.fn()}
        updateSubListItem={vi.fn()}
        removeSubListItem={vi.fn()}
      />,
    );

    expect(html).toContain("contacts.form.relationshipInstructions");
    expect(html).toContain('data-testid="form-select"');
    expect(html).toContain("Parent");
    expect(html).toContain("Child");
    expect(html).toContain("Husband");
    expect(html).toContain("Wife");
    expect(html).toContain("Guardian");
    expect(html).toContain("Dependent");
    expect(html).toContain("Brother");
    expect(html).toContain("contacts.form.linkContact");
  });

  it("updates contactId, name, and phone when a contact is selected in ContactPicker", () => {
    const updateSubListItem = vi.fn();
    renderToStaticMarkup(
      <ContactRelationshipTab
        contactDraft={{
          relationshipContacts: [{ contactId: "", relationship: "Parent" }],
        }}
        formInstanceId="inst-1"
        getLocalId={() => "loc-1"}
        isFieldEnabled={() => true}
        isFieldRequired={() => false}
        getListItemError={() => undefined}
        fields={{}}
        addSubListItem={vi.fn()}
        ensureSubListItem={vi.fn()}
        updateSubListItem={updateSubListItem}
        removeSubListItem={vi.fn()}
      />,
    );

    expect(capturedPickerProps).not.toBeNull();
    capturedPickerProps?.onChange("cnt-99", {
      id: "cnt-99",
      name: "Ali Khan",
      firstName: "Ali",
      lastName: "Khan",
      phones: [{ number: "+923001234567", isPrimary: true }],
    });

    expect(updateSubListItem).toHaveBeenCalledWith("relationshipContacts", 0, {
      contactId: "cnt-99",
      name: "Ali Khan",
      phone: "+92 3001234567",
    });
  });
});
