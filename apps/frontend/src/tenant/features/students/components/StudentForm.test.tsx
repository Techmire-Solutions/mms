import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StudentForm } from "./StudentForm";

vi.mock("@/tenant/features/students/hooks/useStudentFormState", () => ({
  useStudentFormState: () => ({
    t: (key: string) => key,
    dir: "ltr",
    language: "en",
    saving: false,
    isDirty: false,
    handleSave: vi.fn(),
    linkedContact: { id: "cnt-1", name: "Zayd Harith" },
    studentDraft: { contactId: "cnt-1", grNumber: "GR-101", status: "active" },
    statusBadgeConfig: {},
    isFieldEnabled: () => true,
    isFieldRequired: () => false,
    getFieldError: () => undefined,
    handleContactSelect: vi.fn(),
    handleStudentAvatarChange: vi.fn(),
    handleGrNumberChange: vi.fn(),
    updateDraft: vi.fn(),
    duplicateConfirmOpen: false,
    handleDuplicateDialogOpenChange: vi.fn(),
    confirmDuplicateSave: vi.fn(),
    duplicateErrorKeys: {},
    formInstanceId: "test-form-inst",
    excludeIds: [],
    statusSelectOptions: [],
    fields: {},
  }),
}));

vi.mock("@/components/ui/FormModal", () => ({
  FormModal: ({
    title,
    children,
    footerStart,
  }: {
    title: string;
    children: React.ReactNode;
    footerStart: React.ReactNode;
  }) => (
    <div data-testid="form-modal">
      <h1>{title}</h1>
      <div>{footerStart}</div>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock("@/tenant/features/students/components/StudentFormTabContent", () => ({
  StudentFormTabContent: () => <div data-testid="student-form-tab-content">Tab Content</div>,
}));

describe("StudentForm Component", () => {
  it("renders form modal with title, footer entity chip, and tab content", () => {
    const html = renderToStaticMarkup(<StudentForm onClose={vi.fn()} onSave={vi.fn()} />);

    expect(html).toContain("students.form.addTitle");
    expect(html).toContain("Zayd Harith");
    expect(html).toContain("GR-101");
    expect(html).toContain("Tab Content");
  });
});
