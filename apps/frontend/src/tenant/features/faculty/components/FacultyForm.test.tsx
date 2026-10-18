import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FacultyForm } from "./FacultyForm";

const { mockControllerState } = vi.hoisted(() => ({
  mockControllerState: {
    errors: {} as Record<string, string>,
    isFieldEnabled: (_fieldId: string) => true,
  },
}));

vi.mock("@/tenant/features/faculty/hooks/useFacultyFormController", () => {
  const getController = () => ({
    t: (key: string) => key,
    dir: "ltr",
    language: "en",
    saving: false,
    errors: mockControllerState.errors,
    facultyDraft: { contactId: "cnt-1", employeeId: "EMP-01", status: "active" },
    isDirty: false,
    defaultSpecialization: "Tajweed",
    specializationOptions: [],
    designationOptions: [],
    statusOptions: [],
    statusConfig: {},
    autoGenerateId: false,
    requireContactLink: true,
    fieldsMap: {},
    linkedContact: { id: "cnt-1", name: "Ustadh Umar" },
    linkedFacultyContactIds: [],
    idPrefix: "FAC-",
    formInstanceId: "test-fac-inst",
    isFieldEnabled: mockControllerState.isFieldEnabled,
    isFieldRequired: () => false,
    getFieldError: () => undefined,
    updateDraft: vi.fn(),
    handleSave: vi.fn(),
    validationErrorSummary: undefined,
    typedDuplicateReason: undefined,
    duplicateConfirmOpen: false,
    handleDuplicateDialogOpenChange: vi.fn(),
    confirmDuplicateSave: vi.fn(),
    duplicateErrorKeys: {},
  });
  return {
    useFacultyFormController: getController,
  };
});

vi.mock("@/components/app/FormModal", () => ({
  FormModal: ({
    title,
    children,
    footerStart,
    tabs,
    activeTab,
    saveOnTabChange,
  }: {
    title: string;
    children: React.ReactNode;
    footerStart: React.ReactNode;
    tabs?: Array<{ key: string; label: string; badge?: number; tone?: string }>;
    activeTab?: string;
    saveOnTabChange?: boolean;
  }) => (
    <div
      data-testid="form-modal"
      data-active-tab={activeTab}
      data-save-on-tab-change={String(saveOnTabChange)}
    >
      <h1>{title}</h1>
      <div data-testid="modal-tabs">
        {tabs?.map((t) => (
          <span key={t.key} data-tab-key={t.key} data-badge={t.badge}>
            {t.label}
          </span>
        ))}
      </div>
      <div>{footerStart}</div>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock("@/tenant/features/faculty/components/FacultyFormTabContent", () => ({
  FacultyFormTabContent: ({ activeTab }: { activeTab?: string }) => (
    <div data-testid="faculty-form-tab-content" data-current-tab={activeTab}>
      Faculty Tab Content: {activeTab}
    </div>
  ),
}));

describe("FacultyForm Component", () => {
  it("renders faculty form modal with title, footer, and tab content", () => {
    mockControllerState.errors = {};
    mockControllerState.isFieldEnabled = () => true;

    const html = renderToStaticMarkup(<FacultyForm onClose={vi.fn()} onSave={vi.fn()} />);

    expect(html).toContain("faculty.form.addTitle");
    expect(html).toContain('data-save-on-tab-change="false"');
    expect(html).toContain("Ustadh Umar");
    expect(html).toContain("Faculty Tab Content: contact");
  });

  it("provides tabs for contact, employment, and designation", () => {
    mockControllerState.errors = {};
    mockControllerState.isFieldEnabled = () => true;

    const html = renderToStaticMarkup(<FacultyForm onClose={vi.fn()} onSave={vi.fn()} />);

    expect(html).toContain('data-tab-key="contact"');
    expect(html).toContain('data-tab-key="employment"');
    expect(html).toContain('data-tab-key="designation"');
    expect(html).not.toContain('data-tab-key="hierarchy"');
    expect(html).not.toContain('data-tab-key="account"');
    expect(html).not.toContain('data-tab-key="notes"');
  });

  it("calculates tab error counts and displays error badges on affected tabs", () => {
    mockControllerState.errors = {
      employeeId: "Employee ID required",
      designationId: "Designation required",
    };
    mockControllerState.isFieldEnabled = () => true;

    const html = renderToStaticMarkup(<FacultyForm onClose={vi.fn()} onSave={vi.fn()} />);

    expect(html).toContain('data-tab-key="employment" data-badge="1"');
    expect(html).toContain('data-tab-key="designation" data-badge="1"');
    expect(html).toContain('data-tab-key="contact"');
    expect(html).not.toContain('data-tab-key="contact" data-badge');
  });

  it("maps designation errors to the designation tab", () => {
    mockControllerState.errors = {
      designation: "Designation required",
    };
    mockControllerState.isFieldEnabled = () => true;

    const html = renderToStaticMarkup(<FacultyForm onClose={vi.fn()} onSave={vi.fn()} />);

    expect(html).toContain('data-tab-key="designation" data-badge="1"');
    expect(html).not.toContain('data-tab-key="account"');
  });
});
