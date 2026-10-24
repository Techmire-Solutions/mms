import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { PlatformSidebarFooter } from "./PlatformSidebarFooter";
import type { PlatformUserProfile } from "@mms/shared";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

const mockUser: PlatformUserProfile = {
  id: "usr-1",
  email: "admin@platform.local",
  name: "Platform Root Admin",
  role: "super_user",
  permissions: {
    workspaces: true,
    onboard: true,
    settings: true,
    admins: true,
    system: true,
  },
  createdAt: "2026-01-01T00:00:00Z",
  emailVerifiedAt: "2026-01-01T00:00:00Z",
};

describe("PlatformSidebarFooter", () => {
  it("renders user name and sign out button in expanded mode", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PlatformSidebarFooter
          collapsed={false}
          platformUser={mockUser}
          isSuperUser={true}
          onSignOutClick={vi.fn()}
          onToggleCollapsed={vi.fn()}
          onCloseMobile={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(html).toContain("Platform Root Admin");
    expect(html).toContain("platform.roleSuperUser");
    expect(html).toContain('aria-label="platform.signOut"');
    expect(html).toContain('aria-label="nav.collapse"');
  });

  it("renders toggle with expand label when collapsed", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PlatformSidebarFooter
          collapsed={true}
          platformUser={mockUser}
          isSuperUser={false}
          onSignOutClick={vi.fn()}
          onToggleCollapsed={vi.fn()}
          onCloseMobile={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(html).toContain('aria-label="nav.expand"');
    expect(html).toContain('aria-label="platform.signOut"');
  });
});
