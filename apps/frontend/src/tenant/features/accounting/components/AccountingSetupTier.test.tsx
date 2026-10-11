import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountingSetupTier } from "./AccountingSetupTier";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/ui/ModuleTierMotion", () => ({
  ModuleTierMotion: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="module-tier-motion">{children}</div>
  ),
}));

vi.mock("@/components/ui/SetupReadOnlyMessage", () => ({
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

vi.mock("./AccountingSettings", () => ({
  default: () => <div data-testid="accounting-settings">Accounting Settings Panel</div>,
  AccountingSettings: () => <div data-testid="accounting-settings">Accounting Settings Panel</div>,
}));

describe("AccountingSetupTier Component", () => {
  it("renders accounting setup tier in editable mode", () => {
    mockCanEditSetup = true;
    const html = renderToStaticMarkup(
      <AccountingSetupTier accounts={[]} fiscalYears={[]} onSaveFiscalYears={vi.fn()} />,
    );
    expect(html).toContain("module-tier-motion");
    expect(html).toBeDefined();
  });

  it("renders read-only message when canEditSetup is false", () => {
    mockCanEditSetup = false;
    const html = renderToStaticMarkup(
      <AccountingSetupTier accounts={[]} fiscalYears={[]} onSaveFiscalYears={vi.fn()} />,
    );
    expect(html).toContain("setup-read-only-message");
    expect(html).toContain("accounting.setup.readOnly");
  });
});
