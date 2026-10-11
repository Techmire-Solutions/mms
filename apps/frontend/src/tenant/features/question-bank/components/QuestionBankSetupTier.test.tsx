import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QuestionBankSetupTier } from "./QuestionBankSetupTier";

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
    <div data-testid="read-only">{title}</div>
  ),
}));

let mockCanEditSetup = true;

vi.mock("@/tenant/hooks/usePermissions", () => ({
  useModulePermissions: () => ({
    canEditSetup: mockCanEditSetup,
  }),
}));

vi.mock("./QuestionBankSettings", () => ({
  default: () => <div data-testid="settings">Question Bank Settings</div>,
  QuestionBankSettings: () => <div data-testid="settings">Question Bank Settings</div>,
}));

describe("QuestionBankSetupTier Component", () => {
  it("renders settings when canEditSetup is true", () => {
    mockCanEditSetup = true;
    const html = renderToStaticMarkup(<QuestionBankSetupTier />);

    expect(html).toContain("module-tier-motion");
    expect(html).toBeDefined();
  });

  it("renders read-only message when canEditSetup is false", () => {
    mockCanEditSetup = false;
    const html = renderToStaticMarkup(<QuestionBankSetupTier />);

    expect(html).toContain("questionBank.setup.readOnly");
  });
});
