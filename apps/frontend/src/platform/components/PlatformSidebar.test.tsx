import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { PlatformSidebar } from "./PlatformSidebar";

let mockIsAuth = true;
let mockCollapsed = false;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => true,
}));

vi.mock("@/platform/lib/PlatformAuthContext", () => ({
  usePlatformAuth: () => ({
    platformUser: { id: "admin-1", name: "Zaid", email: "zaid@example.com" },
    platformLogout: vi.fn(),
  }),
}));

vi.mock("@/platform/hooks/usePlatformPermissions", () => ({
  usePlatformPermissions: () => ({
    isPlatformAuthenticated: mockIsAuth,
    isSuperUser: true,
    canAdmins: true,
    canMaintenance: true,
    canTelemetry: true,
  }),
}));

vi.mock("@/platform/lib/PlatformSidebarContext", () => ({
  usePlatformSidebar: () => ({
    collapsed: mockCollapsed,
    toggleCollapsed: vi.fn(),
    openCommandPalette: vi.fn(),
  }),
}));

describe("PlatformSidebar", () => {
  it("returns null when unauthenticated", () => {
    mockIsAuth = false;
    mockCollapsed = false;

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PlatformSidebar />
      </MemoryRouter>,
    );

    expect(html).toBe("");
  });

  it("renders desktop sidebar with expanded width when collapsed is false", () => {
    mockIsAuth = true;
    mockCollapsed = false;

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PlatformSidebar />
      </MemoryRouter>,
    );

    expect(html).toContain('aria-label="platform.navAria"');
    expect(html).toContain("w-sidebar");
  });

  it("renders desktop sidebar with collapsed width when collapsed is true", () => {
    mockIsAuth = true;
    mockCollapsed = true;

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PlatformSidebar />
      </MemoryRouter>,
    );

    expect(html).toContain('aria-label="platform.navAria"');
    expect(html).toContain("w-sidebar-collapsed");
  });
});
