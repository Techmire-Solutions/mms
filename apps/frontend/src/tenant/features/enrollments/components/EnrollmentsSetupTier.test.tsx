import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EnrollmentsSetupTier } from "./EnrollmentsSetupTier";

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

vi.mock("@/tenant/features/enrollments/components/EnrollmentsSettings", () => ({
  default: () => <div data-testid="enrollments-settings">Enrollments Settings Panel</div>,
  EnrollmentsSettings: () => (
    <div data-testid="enrollments-settings">Enrollments Settings Panel</div>
  ),
}));

describe("EnrollmentsSetupTier Component", () => {
  it("renders setup tier in editable mode without crashing", () => {
    mockCanEditSetup = true;
    const html = renderToStaticMarkup(<EnrollmentsSetupTier />);
    expect(html).toContain("module-tier-motion");
    expect(html).toBeDefined();
  });

  it("renders read-only message when canEditSetup is false", () => {
    mockCanEditSetup = false;
    const html = renderToStaticMarkup(<EnrollmentsSetupTier />);
    expect(html).toContain("setup-read-only-message");
    expect(html).toContain("enrollments.setup.readOnly");
  });
});
