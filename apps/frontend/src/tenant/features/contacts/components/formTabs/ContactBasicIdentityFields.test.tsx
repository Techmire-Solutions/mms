import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactBasicIdentityFields } from "./ContactBasicIdentityFields";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/ui/FormPrimitives", () => ({
  Field: ({
    label,
    required,
    children,
  }: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
  }) => (
    <div data-testid="form-field" data-required={required ? "true" : "false"}>
      <label>
        {label}
        {required ? " *" : ""}
      </label>
      {children}
    </div>
  ),
  EditableSelect: ({
    options,
    value,
    placeholder,
  }: {
    options?: string[];
    value?: string;
    placeholder?: string;
  }) => (
    <div data-testid="editable-select" data-value={value} data-placeholder={placeholder}>
      {(options ?? []).join("|")}
    </div>
  ),
}));

vi.mock("./ContactBasicMetaFields", () => ({
  ContactBasicMetaFields: () => <div data-testid="meta-fields">Meta Fields</div>,
}));

describe("ContactBasicIdentityFields Component", () => {
  it("renders firstName, lastName, and gender EditableSelect with default options", () => {
    const html = renderToStaticMarkup(
      <ContactBasicIdentityFields
        contactDraft={{ firstName: "Zayd", lastName: "Harith", gender: "male" }}
        formInstanceId="inst-1"
        isFieldEnabled={() => true}
        isFieldRequired={(tab, field) => field === "firstName" || field === "gender"}
        getFieldError={() => undefined}
        updateDraft={vi.fn()}
        onUpdateGenders={vi.fn()}
        lockGender={false}
      />,
    );

    expect(html).toContain("contacts.fields.firstName");
    expect(html).toContain("contacts.fields.lastName");
    expect(html).toContain("contacts.fields.gender *");
    expect(html).toContain("male|female");
    expect(html).toContain('data-value="male"');
    expect(html).toContain("Meta Fields");
  });

  it("renders custom genders when provided", () => {
    const html = renderToStaticMarkup(
      <ContactBasicIdentityFields
        contactDraft={{ firstName: "Zayd", lastName: "Harith", gender: "other" }}
        formInstanceId="inst-1"
        isFieldEnabled={() => true}
        isFieldRequired={() => false}
        getFieldError={() => undefined}
        updateDraft={vi.fn()}
        genders={["male", "female", "other"]}
        onUpdateGenders={vi.fn()}
        lockGender={false}
      />,
    );

    expect(html).toContain("male|female|other");
    expect(html).toContain('data-value="other"');
  });
});
