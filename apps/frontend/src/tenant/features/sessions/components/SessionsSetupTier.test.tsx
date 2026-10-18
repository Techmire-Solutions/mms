import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SessionsSetupTier } from "./SessionsSetupTier";

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

vi.mock("@/tenant/features/sessions/components/SessionsSettings", () => ({
  default: () => <div data-testid="sessions-settings">Sessions Settings Panel</div>,
  SessionsSettings: () => <div data-testid="sessions-settings">Sessions Settings Panel</div>,
}));

describe("SessionsSetupTier Component", () => {
  it("renders setup tier in editable mode without crashing", () => {
    mockCanEditSetup = true;
    const html = renderToStaticMarkup(<SessionsSetupTier />);
    expect(html).toContain("module-tier-motion");
    expect(html).toBeDefined();
  });

  it("renders read-only message when canEditSetup is false", () => {
    mockCanEditSetup = false;
    const html = renderToStaticMarkup(<SessionsSetupTier />);
    expect(html).toContain("setup-read-only-message");
    expect(html).toContain("sessions.setup.readOnly");
  });
});
