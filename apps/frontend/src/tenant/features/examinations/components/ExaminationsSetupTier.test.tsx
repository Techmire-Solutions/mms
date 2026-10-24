import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ExaminationsSetupTier } from "./ExaminationsSetupTier";

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
    <div data-testid="read-only">{title}</div>
  ),
}));

let mockCanEditSetup = true;

vi.mock("@/tenant/hooks/usePermissions", () => ({
  useModulePermissions: () => ({
    canEditSetup: mockCanEditSetup,
  }),
}));

vi.mock("./ExaminationsSettings", () => ({
  default: () => <div data-testid="settings">Examinations Settings</div>,
  ExaminationsSettings: () => <div data-testid="settings">Examinations Settings</div>,
}));

describe("ExaminationsSetupTier Component", () => {
  it("renders examinations settings when canEditSetup is true", () => {
    mockCanEditSetup = true;
    const html = renderToStaticMarkup(<ExaminationsSetupTier />);

    expect(html).toContain("module-tier-motion");
    expect(html).toBeDefined();
  });

  it("renders read-only message when canEditSetup is false", () => {
    mockCanEditSetup = false;
    const html = renderToStaticMarkup(<ExaminationsSetupTier />);

    expect(html).toContain("examinations.setup.readOnly");
  });
});
