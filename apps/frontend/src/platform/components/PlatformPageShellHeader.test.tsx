import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { PlatformPageShellHeader } from "./PlatformPageShellHeader";

vi.mock("@/platform/lib/PlatformSidebarContext", () => ({
  usePlatformSidebar: () => ({
    openMobileSidebar: vi.fn(),
    closeMobileSidebar: vi.fn(),
    mobileOpen: false,
    collapsed: false,
    toggleCollapsed: vi.fn(),
  }),
}));

vi.mock("@/platform/lib/PlatformAuthContext", () => ({
  usePlatformAuth: () => ({
    platformUser: { id: "u1", name: "Zaid", email: "zaid@example.com" },
    platformLogout: vi.fn(),
  }),
}));

vi.mock("@/platform/hooks/usePlatformPermissions", () => ({
  usePlatformPermissions: () => ({
    isPlatformAuthenticated: true,
    platformUser: { id: "u1", name: "Zaid" },
    isSuperUser: false,
    canAdmins: false,
  }),
}));

vi.mock("@/platform/hooks/usePlatformWorkspaces", () => ({
  usePlatformWorkspaces: () => ({
    data: [],
  }),
}));

vi.mock("@/platform/hooks/usePlatformHealth", () => ({
  usePlatformHealth: () => ({
    status: "operational",
  }),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("PlatformPageShellHeader", () => {
  it("renders mobile hamburger button with responsive classes and accessible label", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/platform/dashboard"]}>
        <PlatformPageShellHeader />
      </MemoryRouter>,
    );

    expect(html).toContain('aria-label="nav.openMenu"');
    expect(html).toContain("lg:hidden");
    expect(html).toContain("platform.consoleTitle");
  });
});
