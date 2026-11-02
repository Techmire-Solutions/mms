import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ContactSystemTag } from "@mms/shared";
import { ContactBasicMetaFields } from "./ContactBasicMetaFields";

const captured = vi.hoisted(() => ({
  values: [] as string[],
  options: [] as string[],
}));

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
  EditableMultiSelect: ({
    placeholder,
    values,
    options,
  }: {
    placeholder?: string;
    values: string[];
    options: string[];
  }) => {
    captured.values = values;
    captured.options = options;
    return <div data-testid="multi-select">{placeholder}</div>;
  },
  FormCheckboxCard: ({ label, checked }: { label: string; checked: boolean }) => (
    <div data-testid="checkbox-card">
      <span>{label}</span>
      <span>{checked ? "checked" : "unchecked"}</span>
    </div>
  ),
}));

const systemTags: ContactSystemTag[] = [
  { name: "Student", source: "student", systemKey: "student:self", archived: false },
  {
    name: "faculty-Teacher",
    source: "faculty",
    systemKey: "faculty:designation:1",
    archived: false,
  },
];

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

  it("renders system tags read-only and keeps them out of the editable select", () => {
    const html = renderToStaticMarkup(
      <ContactBasicMetaFields
        contactDraft={{
          tags: ["VIP", "Student", "faculty-Teacher", "Former Student"],
          tag: "VIP, Student, faculty-Teacher, Former Student",
          systemTags,
        }}
        formInstanceId="inst-2"
        isFieldEnabled={() => true}
        isFieldRequired={() => false}
        getFieldError={() => undefined}
        updateDraft={vi.fn()}
        tags={["VIP", "Student", "faculty-Teacher", "Former Student", "Donor"]}
        onUpdateTags={vi.fn()}
      />,
    );

    expect(captured.values).toEqual(["VIP"]);
    expect(captured.options).toEqual(["VIP", "Donor"]);
    expect(html).toContain("Student");
    expect(html).toContain("faculty-Teacher");
    expect(html).toContain("contacts.tags.systemHint");
    expect(html).toContain("lucide-lock");
    expect(html).not.toContain("lucide-x");
  });
});
