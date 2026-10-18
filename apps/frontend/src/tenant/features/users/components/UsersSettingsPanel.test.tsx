import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { UsersSettingsPanel } from "./UsersSettingsPanel";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
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


vi.mock("@/components/app/ModuleSetupSaveFooter", () => ({
  ModuleSetupSaveFooter: () => <div data-testid="save-footer">Save Footer</div>,
}));

describe("UsersSettingsPanel Component", () => {
  it("renders section card and save footer", () => {
    const html = renderToStaticMarkup(
      <UsersSettingsPanel
        settingsDraft={{ allowSelfRegistration: false, requireEmailVerification: false }}
        saved={true}
        saving={false}
        isDirty={false}
        upd={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(html).toContain("users.settingsPrefsTitle");
    expect(html).toContain("Save Footer");
  });
});
