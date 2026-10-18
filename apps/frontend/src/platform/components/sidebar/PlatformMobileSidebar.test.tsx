import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { PlatformMobileSidebar } from "./PlatformMobileSidebar";

let mockMobileOpen = true;
let mockIsAuth = true;

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
    mobileOpen: mockMobileOpen,
    closeMobileSidebar: vi.fn(),
    openCommandPalette: vi.fn(),
  }),
}));

describe("PlatformMobileSidebar", () => {
  it("returns null when mobileOpen is false", () => {
    mockMobileOpen = false;
    mockIsAuth = true;

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PlatformMobileSidebar />
      </MemoryRouter>,
    );

    expect(html).toBe("");
  });

  it("returns null when unauthenticated", () => {
    mockMobileOpen = true;
    mockIsAuth = false;

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PlatformMobileSidebar />
      </MemoryRouter>,
    );

    expect(html).toBe("");
  });

  it("renders mobile drawer dialog and overlay when open and authenticated", () => {
    mockMobileOpen = true;
    mockIsAuth = true;

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PlatformMobileSidebar />
      </MemoryRouter>,
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("data-overlay-backdrop");
    expect(html).toContain("lg:hidden");
    expect(html).toContain('aria-label="platform.nav.searchConsole"');
  });
});
