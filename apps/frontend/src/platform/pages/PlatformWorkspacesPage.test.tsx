import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import PlatformWorkspacesPage from "./PlatformWorkspacesPage";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (k: string, p?: Record<string, string>) => {
      const map: Record<string, string> = {
        "platform.manageMadrasas": "Madrasas Directory",
        "platform.consoleTitle": "Platform Console",
        "platform.consoleSubtitle": `System management for ${p?.name ?? "Admin"}`,
        "auth.createMadrasa": "Create Madrasa",
      };
      return map[k] ?? k;
    },
  }),
}));

vi.mock("@/platform/hooks/usePlatformPermissions", () => ({
  usePlatformPermissions: () => ({
    canOnboard: true,
    isSuperUser: true,
    platformUser: { id: "admin-1", name: "Zaid", email: "zaid@example.com" },
  }),
}));

vi.mock("@/platform/components/PlatformWorkspaceList", () => ({
  default: () => <div data-testid="platform-workspaces-list">Workspaces Content</div>,
}));

describe("PlatformWorkspacesPage", () => {
  it("renders workspaces directory with header and onboarding action", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PlatformWorkspacesPage />
      </MemoryRouter>,
    );

    expect(html).toContain("Madrasas Directory");
    expect(html).toContain("System management for Zaid");
    expect(html).toContain("Create Madrasa");
    expect(html).toContain("Workspaces Content");
  });
});
