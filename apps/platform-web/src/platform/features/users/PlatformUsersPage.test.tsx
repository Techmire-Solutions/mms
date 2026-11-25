import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import PlatformUsersPage from "@/platform/features/users/PlatformUsersPage";

vi.mock("@mms/fe-core/i18n", () => ({
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
    can: () => true,
    platformUser: { id: "admin-1", name: "Zaid", email: "zaid@example.com" },
  }),
}));

vi.mock("@/platform/features/users/hooks/usePlatformAdmins", () => ({
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

vi.mock("@/platform/features/users/components/PlatformAddAdminForm", () => ({
  PlatformAddAdminForm: () => <button type="button">Add Admin</button>,
}));

vi.mock("@/platform/features/users/components/PlatformUsersWorkTier", () => ({
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
    // Primary operational tab is labelled with the module name, not "module.work".
    expect(html).toContain("nav.users");
    expect(html).not.toContain("module.work");
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
