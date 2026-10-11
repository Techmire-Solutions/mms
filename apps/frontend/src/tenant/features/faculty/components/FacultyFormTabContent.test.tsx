import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FacultyFormTabContent } from "./FacultyFormTabContent";

vi.mock("@/components/contactLink/ContactPicker", () => ({
  default: () => <div data-testid="contact-picker">contact-picker</div>,
}));

vi.mock("./FacultyCatalogCreateOverlays", () => ({
  FacultyCatalogCreateOverlays: () => null,
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const defaultProps = {
  formInstanceId: "inst-fac-1",
  facultyDraft: {
    employeeId: "EMP-001",
  },
  errors: {},
  fields: {},
  linkedFacultyContactIds: [],
  autoGenerateId: false,
  idPrefix: "FAC-",
  statusOptions: [{ value: "active", label: "Active" }],
  isFieldEnabled: () => true,
  isFieldRequired: () => false,
  getFieldError: () => undefined,
  onDraftChange: vi.fn(),
};

describe("FacultyFormTabContent Component", () => {
  it("renders contact, employment, and designation without notes or user account", () => {
    const html = renderToStaticMarkup(
      <FacultyFormTabContent
        {...defaultProps}
        facultyDraft={{ ...defaultProps.facultyDraft, contactId: "cnt-1" }}
        linkedContact={
          {
            id: "cnt-1",
            name: "Ustadh Umar",
            phones: [{ number: "+923001234567" }],
            emails: [{ address: "umar@example.com" }],
            education: [{ degree: "M.A. Islamic Studies", fieldOfStudy: "Tajweed" }],
          } as unknown as import("@mms/shared").Contact
        }
      />,
    );

    expect(html).toContain("contact-picker");
    expect(html).toContain("3001234567");
    expect(html).toContain("umar@example.com");
    expect(html).toContain("M.A. Islamic Studies");
    expect(html).toContain("Tajweed");

    expect(html).not.toContain("faculty.form.sectionDetails");
    expect(html).toContain("faculty.form.sectionEmployment");
    expect(html).toContain("faculty.form.employeeIdManualHint");

    expect(html).not.toContain("faculty.form.notesSection");
    expect(html).not.toContain("user-account-section");
    expect(html).not.toContain("faculty.form.sectionUserAccount");
  });
});
