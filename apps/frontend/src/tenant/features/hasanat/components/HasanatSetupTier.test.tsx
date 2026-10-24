import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HasanatSetupTier } from "./HasanatSetupTier";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/app/ModuleTierMotion", () => ({
  ModuleTierMotion: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="module-tier-motion">{children}</div>
  ),
}));

vi.mock("@/components/app/SetupReadOnlyMessage", () => ({
  SetupReadOnlyMessage: ({ title }: { title: string }) => (
    <div data-testid="setup-read-only-message">{title}</div>
  ),
}));

vi.mock("@/components/app/SubTabBar", () => ({
  SubTabBar: () => <div data-testid="sub-tab-bar">SubTabBar</div>,
}));

vi.mock("./DenominationsManager", () => ({
  default: () => <div data-testid="denominations-manager">Denominations Manager</div>,
  DenominationsManager: () => <div data-testid="denominations-manager">Denominations Manager</div>,
}));

vi.mock("./HasanatSettings", () => ({
  default: () => <div data-testid="hasanat-settings">Hasanat Settings</div>,
  HasanatSettings: () => <div data-testid="hasanat-settings">Hasanat Settings</div>,
}));

describe("HasanatSetupTier Component", () => {
  const defaultProps = {
    tabs: [
      { id: "denominations", label: "Denominations" },
      { id: "preferences", label: "Preferences" },
    ],
    activeTab: "denominations",
    canEditSetup: true,
    canWrite: true,
    denoms: [],
    onTabChange: vi.fn(),
    onUpdateDenoms: vi.fn(),
  };

  it("renders subtab bar and tier motion in editable mode", () => {
    const html = renderToStaticMarkup(<HasanatSetupTier {...defaultProps} />);
    expect(html).toContain("module-tier-motion");
    expect(html).toContain("SubTabBar");
  });

  it("renders read-only message when canEditSetup is false", () => {
    const html = renderToStaticMarkup(<HasanatSetupTier {...defaultProps} canEditSetup={false} />);
    expect(html).toContain("setup-read-only-message");
    expect(html).toContain("hasanat.setup.readOnly");
  });
});
