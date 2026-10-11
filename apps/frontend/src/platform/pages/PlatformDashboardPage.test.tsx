import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import PlatformDashboardPage from "./PlatformDashboardPage";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (k: string, p?: Record<string, string>) => {
      const map: Record<string, string> = {
        "dashboard.title": "Console Dashboard",
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

vi.mock("@/platform/components/PlatformDashboard", () => ({
  PlatformDashboard: () => <div data-testid="platform-dashboard-view">Dashboard Telemetry</div>,
}));

describe("PlatformDashboardPage", () => {
  it("renders dashboard page with SEO header and create button", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PlatformDashboardPage />
      </MemoryRouter>,
    );

    expect(html).toContain("Console Dashboard");
    expect(html).toContain("System management for Zaid");
    expect(html).toContain("Create Madrasa");
    expect(html).toContain("Dashboard Telemetry");
  });
});
