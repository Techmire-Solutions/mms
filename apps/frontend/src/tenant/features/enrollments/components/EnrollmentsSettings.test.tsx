import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EnrollmentsSettings } from "./EnrollmentsSettings";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockCanEdit = true;

vi.mock("@/tenant/hooks/usePermissions", () => ({
  useModulePermissions: () => ({
    canEditSetup: mockCanEdit,
  }),
}));

vi.mock("@/tenant/features/enrollments/hooks/useEnrollmentsSetupPanelState", () => ({
  useEnrollmentsSetupPanelState: () => ({
    settingsDraft: {
      maxStudentsPerClass: "30",
      dropDeadlineDays: "14",
      waitlistEnabled: true,
      requireEligibilityCheck: true,
      autoAssignClass: false,
      enrollmentApproval: true,
      allowTransfers: true,
      reenrollmentReminder: true,
      defaultViewLayout: "table",
    },
    saved: true,
    saving: false,
    isPrefsDirty: false,
    isDirty: false,
    upd: vi.fn(),
    handleSave: vi.fn(),
  }),
}));

vi.mock("@/components/app/ModuleSetupSaveFooter", () => ({
  ModuleSetupSaveFooter: () => <div data-testid="save-footer">Save Footer</div>,
}));

describe("EnrollmentsSettings Component", () => {
  it("renders settings fields and toggle rows", () => {
    const html = renderToStaticMarkup(<EnrollmentsSettings />);
    expect(html).toContain("enrollments.settings.title");
    expect(html).toContain("enrollments.settings.maxStudentsPerClass");
    expect(html).toContain("30");
    expect(html).toContain("enrollments.settings.waitlistEnabled");
    expect(html).toContain("Save Footer");
  });
});
