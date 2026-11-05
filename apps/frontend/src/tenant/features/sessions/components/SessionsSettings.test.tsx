import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SessionsSettings } from "./SessionsSettings";

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

vi.mock("@/tenant/features/sessions/hooks/useSessionsSetupPanelState", () => ({
  useSessionsSetupPanelState: () => ({
    settingsDraft: {
      defaultDuration: "45",
      defaultSessionType: "regular",
      academicYear: "2026-2027",
      sessionStart: "january",
      allowOverlap: false,
      archiveOldSessions: false,
      requireBudget: false,
      timetableConflictCheck: true,
      notifyOnSessionStart: false,
      defaultViewLayout: "table",
    },
    typeOptions: ["regular", "intensive"],
    upd: vi.fn(),
    saved: true,
    saving: false,
    isPrefsDirty: false,
    handleSave: vi.fn(),
  }),
}));

describe("SessionsSettings Component", () => {
  it("renders preference form and save footer", () => {
    const html = renderToStaticMarkup(<SessionsSettings />);
    expect(html).toContain("sessions.settings.title");
    expect(html).toContain("academicYear");
    // One page-level save action; the old in-card footer duplicated it.
    expect(html.match(/settings\.savedBadge/g)).toHaveLength(1);
  });
});
