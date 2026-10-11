import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { PlatformCommandPalette } from "./PlatformCommandPalette";

const mockUsePlatformPermissions = vi.fn();
vi.mock("@/platform/hooks/usePlatformPermissions", () => ({
  usePlatformPermissions: () => mockUsePlatformPermissions(),
}));

const mockUsePlatformWorkspaces = vi.fn();
vi.mock("@/platform/hooks/usePlatformWorkspaces", () => ({
  usePlatformWorkspaces: () => mockUsePlatformWorkspaces(),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (params?.query) return `No matches for ${params.query}`;
      const map: Record<string, string> = {
        "dashboard.title": "Dashboard",
        "platform.manageMadrasas": "Manage Madrasas",
        "module.reports": "Reports",
        "platform.activityLogsTitle": "Activity Logs",
        "platform.systemMaintenance": "System Maintenance",
        "platform.erdTitle": "Schema ERD",
        "platform.adminsTitle": "Administrators",
        "platform.myAccount": "My Account",
        "auth.createMadrasa": "Create Madrasa",
        "platform.profileMigrateRestart": "Migrate & Restart",
        "platform.commandCategory.navigation": "Navigation",
        "platform.commandCategory.actions": "Actions",
        "platform.searchConsolePlaceholder": "Search console...",
        "platform.openSearchAria": "Quick search console",
        "platform.consoleTitle": "Platform Console",
      };
      return map[key] ?? key;
    },
  }),
}));

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => true,
}));

describe("PlatformCommandPalette Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePlatformPermissions.mockReturnValue({
      canWorkspaces: true,
      canOnboard: true,
      canSettings: true,
      canSystem: true,
      canAdmins: true,
    });
    mockUsePlatformWorkspaces.mockReturnValue({
      data: [
        { subdomain: "alhuda", madrasaName: "Al-Huda Academy", enabled: true },
        { subdomain: "noor", madrasaName: "Noor Institute", enabled: false },
      ],
    });
  });

  it("renders nothing when open is false", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PlatformCommandPalette open={false} onClose={vi.fn()} />
      </MemoryRouter>,
    );
    expect(html).toBe("");
  });

  it("renders search input, navigation items, and dynamic workspaces when open is true", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PlatformCommandPalette open={true} onClose={vi.fn()} />
      </MemoryRouter>,
    );

    expect(html).toContain("Search console...");
    expect(html).toContain("Dashboard");
    expect(html).toContain("Al-Huda Academy");
    expect(html).toContain("alhuda");
    expect(html).toContain("Noor Institute");
    expect(html).toContain("noor");
  });

  it("filters out privileged commands when operator lacks capabilities", () => {
    mockUsePlatformPermissions.mockReturnValue({
      canWorkspaces: false,
      canOnboard: false,
      canSettings: false,
      canSystem: false,
      canAdmins: false,
    });
    mockUsePlatformWorkspaces.mockReturnValue({ data: [] });

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PlatformCommandPalette open={true} onClose={vi.fn()} />
      </MemoryRouter>,
    );

    expect(html).not.toContain("Administrators");
    expect(html).not.toContain("Activity Logs");
    expect(html).not.toContain("System Maintenance");
    expect(html).not.toContain("Schema ERD");
    expect(html).not.toContain("Create Madrasa");
    expect(html).toContain("Dashboard");
    expect(html).toContain("My Account");
  });
});
