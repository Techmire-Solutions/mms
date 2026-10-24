import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import PlatformUsersPage from "./PlatformUsersPage";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => true,
}));

vi.mock("@/platform/hooks/usePlatformPermissions", () => ({
  usePlatformPermissions: () => ({
    canAdmins: true,
    canSystem: true,
    canSettings: true,
    isSuperUser: true,
    platformUser: { id: "admin-1", name: "Zaid", email: "zaid@example.com" },
  }),
}));

vi.mock("@/platform/hooks/usePlatformAdmins", () => ({
  usePlatformAdmins: () => ({
    data: [
      {
        id: "admin-1",
        name: "Zaid",
        email: "zaid@example.com",
        role: "super_user",
        permissions: {
          workspaces: true,
          onboard: true,
          settings: true,
          admins: true,
          system: true,
        },
      },
    ],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useUpdatePlatformAdminPermissions: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useVerifyPlatformAdminEmail: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/platform/pages/PlatformAddAdminForm", () => ({
  PlatformAddAdminForm: () => <button type="button">Add Admin</button>,
}));

vi.mock("@/platform/components/users/PlatformUsersWorkTier", () => ({
  PlatformUsersWorkTier: () => <div data-testid="platform-users-work-tier">Work Tier</div>,
}));

describe("PlatformUsersPage", () => {
  it("renders 3-tier users page with tabs and header", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PlatformUsersPage />
      </MemoryRouter>,
    );

    expect(html).toContain("nav.users");
    expect(html).toContain("platform.adminsSubtitle");
    expect(html).toContain("module.work");
    expect(html).toContain("module.reports");
    expect(html).toContain("module.setup");
  });

  it("renders reports tab when specified in query string", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/platform/users?tab=reports"]}>
        <PlatformUsersPage />
      </MemoryRouter>,
    );

    expect(html).toContain("nav.users");
    expect(html).toContain("module.reports");
  });

  it("renders setup tab when specified in query string", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={["/platform/users?tab=setup"]}>
        <PlatformUsersPage />
      </MemoryRouter>,
    );

    expect(html).toContain("nav.users");
    expect(html).toContain("module.setup");
  });
});
