import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StudentContactSection } from "./StudentContactSection";

vi.mock("@/components/contactLink/ContactPicker", () => ({
  default: ({ value, label }: { value: string; label: string }) => (
    <div data-testid="contact-picker">
      {label}:{value}
    </div>
  ),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const defaultProps = {
  contactId: "cnt-123",
  excludeIds: [],
  linkedGenderRaw: "male",
  linkedGenderLabel: "Male",
  linkedDob: "2015-05-10",
  fields: {},
  isFieldEnabled: () => true,
  isFieldRequired: () => false,
  getFieldError: () => undefined,
  onContactSelect: vi.fn(),
  onStudentAvatarChange: vi.fn(),
};

describe("StudentContactSection Component", () => {
  it("renders contact picker and profile values", () => {
    const html = renderToStaticMarkup(<StudentContactSection {...defaultProps} />);

    expect(html).toContain("students.form.contactLabel");
    expect(html).toContain("cnt-123");
    expect(html).toContain("Male");
    expect(html).toContain("2015-05-10");
  });

  it("returns null when contact field and profile row are disabled", () => {
    const html = renderToStaticMarkup(
      <StudentContactSection {...defaultProps} isFieldEnabled={() => false} />,
    );

    expect(html).toBe("");
  });
});
