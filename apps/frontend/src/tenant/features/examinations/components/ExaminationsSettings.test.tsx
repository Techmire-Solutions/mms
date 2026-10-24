import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ExaminationsSettings } from "./ExaminationsSettings";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/features/examinations/hooks/useExaminationsSetupPanelState", () => ({
  useExaminationsSetupPanelState: () => ({
    settingsDraft: {
      gradingSystem: "percentage",
      certificateTemplate: "default",
      passMark: "50",
      maxMark: "100",
      showRankings: true,
      allowRetake: false,
      autoPublishResults: true,
      notifyOnResult: false,
      aiGrading: false,
      distinguishHonours: false,
      examReminders: true,
    },
    saved: true,
    saving: false,
    isPrefsDirty: false,
    isDirty: false,
    upd: vi.fn(),
    handleSave: vi.fn(),
  }),
}));

vi.mock("@/components/app/SectionCard", () => ({
  SectionCard: ({ children, title }: { children: React.ReactNode; title: React.ReactNode }) => (
    <div data-testid="section-card">
      <h3>{title}</h3>
      {children}
    </div>
  ),
}));

vi.mock("@/components/app/FormSelect", () => ({
  FormSelect: () => <div data-testid="form-select">FormSelect</div>,
}));

vi.mock("@/components/app/ModuleSetupSaveFooter", () => ({
  ModuleSetupSaveFooter: () => <div data-testid="save-footer">Save Footer</div>,
}));

describe("ExaminationsSettings Component", () => {
  it("renders section card and save footer", () => {
    const html = renderToStaticMarkup(<ExaminationsSettings />);
    expect(html).toContain("examinations.settings.titlePreferences");
    expect(html).toContain("Save Footer");
  });
});
