import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HasanatSettings } from "./HasanatSettings";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/features/hasanat/hooks/useHasanatSetupPanelState", () => ({
  useHasanatSetupPanelState: () => ({
    settingsDraft: {
      pointsPerUnit: 10,
      autoApprovePayouts: true,
      defaultViewLayout: "list",
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
  SectionCard: ({ title, children }: { title: React.ReactNode; children: React.ReactNode }) => (
    <div data-testid="section-card">
      <h2>{title}</h2>
      {children}
    </div>
  ),
}));

vi.mock("@/components/app/ModuleSetupSaveFooter", () => ({
  ModuleSetupSaveFooter: () => <div data-testid="save-footer">Save Footer</div>,
}));

describe("HasanatSettings Component", () => {
  it("renders section card and save footer", () => {
    const html = renderToStaticMarkup(<HasanatSettings />);
    expect(html).toContain("hasanat.settings.titlePreferences");
    expect(html).toContain("Save Footer");
  });
});
