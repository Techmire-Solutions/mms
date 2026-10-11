import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { PlatformUserProfile } from "@mms/shared";
import { PlatformAdminsList } from "./PlatformAdminsList";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const map: Record<string, string> = {
        "platform.manageAdmins": "Manage Operators",
        "platform.roleAll": "All",
        "platform.roleSuperUser": "Super Users",
        "platform.roleAdmin": "Admins",
        "platform.noAdmins": "No platform operators configured",
        "platform.noMatchingAdmins": "No operators matching search query",
        "platform.loadFailed": "Failed to load operators",
        "platform.loadFailedHint": "Please check network connection and try again",
        "common.clearFilters": "Clear filters",
        "common.loading": "Loading...",
        "platform.searchAdminsPlaceholder": "Search by name or email",
        "platform.exportAdminsCsv": "Export CSV",
      };
      return map[key] ?? key;
    },
  }),
}));

vi.mock("@/hooks/useWorkDirectoryViewMode", () => ({
  useWorkDirectoryViewMode: () => ({
    viewMode: "table",
    setViewMode: vi.fn(),
  }),
}));

vi.mock("@/platform/hooks/usePlatformAdmins", () => ({
  useVerifyPlatformAdminEmail: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/platform/components/admin/PlatformAdminsDialogs", () => ({
  PlatformAdminsDialogs: () => null,
}));

const mockAdmins: PlatformUserProfile[] = [
  {
    id: "adm-1",
    name: "Super Admin",
    email: "super@mms.local",
    role: "super_user",
    permissions: {
      workspaces: true,
      onboard: true,
      settings: true,
      admins: true,
      system: true,
    },
    emailVerifiedAt: "2026-01-01T00:00:00Z",
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "adm-2",
    name: "Standard Admin",
    email: "standard@mms.local",
    role: "admin",
    permissions: {
      workspaces: true,
      onboard: false,
      settings: false,
      admins: false,
      system: false,
    },
    createdAt: "2026-02-01T00:00:00Z",
  },
];

describe("PlatformAdminsList", () => {
  it("renders admin list with role sub-tabs and count badges", () => {
    const html = renderToStaticMarkup(
      <PlatformAdminsList
        admins={mockAdmins}
        loading={false}
        fetchError={false}
        onRetry={vi.fn()}
      />,
    );

    expect(html).toContain("Manage Operators (2)");
    expect(html).toContain("Super Admin");
    expect(html).toContain("Standard Admin");
    expect(html).toContain("All (2)");
    expect(html).toContain("Super Users (1)");
    expect(html).toContain("Admins (1)");
  });

  it("renders EmptyState when admin dataset is empty", () => {
    const html = renderToStaticMarkup(
      <PlatformAdminsList admins={[]} loading={false} fetchError={false} onRetry={vi.fn()} />,
    );

    expect(html).toContain("No platform operators configured");
  });

  it("renders error state when fetchError is true", () => {
    const html = renderToStaticMarkup(
      <PlatformAdminsList admins={undefined} loading={false} fetchError={true} onRetry={vi.fn()} />,
    );

    expect(html).toContain("Failed to load operators");
  });

  it("renders table rows with operator details and status", () => {
    const html = renderToStaticMarkup(
      <PlatformAdminsList
        admins={mockAdmins}
        loading={false}
        fetchError={false}
        onRetry={vi.fn()}
      />,
    );

    expect(html).toContain("Super Admin");
    expect(html).toContain("super@mms.local");
  });
});
