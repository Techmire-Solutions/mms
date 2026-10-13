import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FinanceSetupTier } from "./FinanceSetupTier";

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

let mockCanEditSetup = true;

vi.mock("@/tenant/hooks/usePermissions", () => ({
  useModulePermissions: () => ({
    canEditSetup: mockCanEditSetup,
  }),
}));

vi.mock("./FinanceSettings", () => ({
  default: () => <div data-testid="finance-settings">Finance Settings Panel</div>,
  FinanceSettings: () => <div data-testid="finance-settings">Finance Settings Panel</div>,
}));

describe("FinanceSetupTier Component", () => {
  it("renders finance setup tier in editable mode", () => {
    mockCanEditSetup = true;
    const html = renderToStaticMarkup(<FinanceSetupTier />);
    expect(html).toContain("module-tier-motion");
    expect(html).toBeDefined();
  });

  it("renders read-only message when canEditSetup is false", () => {
    mockCanEditSetup = false;
    const html = renderToStaticMarkup(<FinanceSetupTier />);
    expect(html).toContain("setup-read-only-message");
    expect(html).toContain("finance.setup.readOnly");
  });
});
