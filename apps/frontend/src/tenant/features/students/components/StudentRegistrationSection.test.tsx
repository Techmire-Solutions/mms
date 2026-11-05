import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StudentRegistrationSection } from "./StudentRegistrationSection";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const defaultProps = {
  studentDraft: {
    grNumber: "GR-101",
    status: "active" as const,
    registeredDate: "2024-01-01T08:00:00Z",
  },
  isGrAutoAssigned: false,
  grInputDisabled: false,
  statusSelectOptions: [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
  ],
  fields: {},
  isFieldEnabled: () => true,
  isFieldRequired: () => false,
  getFieldError: () => undefined,
  onGrNumberChange: vi.fn(),
  onDraftChange: vi.fn(),
};

describe("StudentRegistrationSection Component", () => {
  it("renders GR number, status, and registered date fields", () => {
    const html = renderToStaticMarkup(<StudentRegistrationSection {...defaultProps} />);

    expect(html).toContain("students.form.registrationSection");
    expect(html).toContain("students.form.grNumber");
    expect(html).toContain("students.form.status");
    expect(html).toContain("GR-101");
  });

  it("returns null when all fields are disabled", () => {
    const html = renderToStaticMarkup(
      <StudentRegistrationSection {...defaultProps} isFieldEnabled={() => false} />,
    );

    expect(html).toBe("");
  });

  it("renders auto-assigned badge, hint, and disabled input when GR is auto-assigned", () => {
    const html = renderToStaticMarkup(
      <StudentRegistrationSection
        {...defaultProps}
        isGrAutoAssigned={true}
        grInputDisabled={true}
        autoGenerateId={true}
        isCreate={true}
        nextGrNumber="0042-2026"
      />,
    );

    expect(html).toContain("students.form.grAutoAssigned");
    expect(html).toContain("students.form.grNumberHint");
    expect(html).toContain("disabled");
  });

  it("renders editable input and no auto-assigned badge when auto-generation is disabled", () => {
    const html = renderToStaticMarkup(
      <StudentRegistrationSection
        {...defaultProps}
        isGrAutoAssigned={false}
        grInputDisabled={false}
        autoGenerateId={false}
        isCreate={true}
      />,
    );

    expect(html).not.toContain("students.form.grAutoAssigned");
    expect(html).toContain('placeholder="students.form.grNumberPlaceholder"');
  });
});
