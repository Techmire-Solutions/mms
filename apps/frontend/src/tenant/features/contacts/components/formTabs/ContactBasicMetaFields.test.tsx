import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ContactBasicMetaFields } from "./ContactBasicMetaFields";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/app/DatePicker", () => ({
  DatePicker: ({ value, name }: { value?: string; name: string }) => (
    <input data-testid={`datepicker-${name}`} value={value || ""} readOnly />
  ),
}));

vi.mock("@/components/app/FormPrimitives", () => ({
  Field: ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div data-testid="form-field">
      <label>{label}</label>
      {children}
    </div>
  ),
  EditableMultiSelect: ({ placeholder }: { placeholder?: string }) => (
    <div data-testid="multi-select">{placeholder}</div>
  ),
  FormCheckboxCard: ({ label, checked }: { label: string; checked: boolean }) => (
    <div data-testid="checkbox-card">
      <span>{label}</span>
      <span>{checked ? "checked" : "unchecked"}</span>
    </div>
  ),
}));

describe("ContactBasicMetaFields Component", () => {
  it("renders enabled meta fields (dob, cnic, tag, isSyed)", () => {
    const html = renderToStaticMarkup(
      <ContactBasicMetaFields
        contactDraft={{ dob: "2000-01-01", cnic: "12345-1234567-1", isSyed: true }}
        formInstanceId="inst-1"
        isFieldEnabled={() => true}
        isFieldRequired={() => false}
        getFieldError={() => undefined}
        updateDraft={vi.fn()}
        tags={["Donor", "Staff"]}
        onUpdateTags={vi.fn()}
      />,
    );

    expect(html).toContain("contacts.fields.dob");
    expect(html).toContain("contacts.form.cnic");
    expect(html).toContain("contacts.fields.tag");
    expect(html).toContain("contacts.fields.isSyed");
  });
});
