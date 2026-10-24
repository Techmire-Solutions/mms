import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlatformAdminActionButtons } from "./PlatformAdminActionButtons";
import type { PlatformUserProfile } from "@mms/shared";
import { DEFAULT_PLATFORM_ADMIN_PERMISSIONS, FULL_PLATFORM_ADMIN_PERMISSIONS } from "@mms/shared";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockAdminUser: PlatformUserProfile = {
  id: "admin-1",
  name: "Standard Admin",
  email: "admin@example.com",
  role: "admin",
  permissions: DEFAULT_PLATFORM_ADMIN_PERMISSIONS,
  disabledAt: null,
  createdAt: "2025-01-01T00:00:00Z",
};

const mockSuperUser: PlatformUserProfile = {
  id: "super-1",
  name: "Super User",
  email: "super@example.com",
  role: "super_user",
  permissions: FULL_PLATFORM_ADMIN_PERMISSIONS,
  disabledAt: null,
  createdAt: "2025-01-01T00:00:00Z",
  emailVerifiedAt: "2025-01-02T00:00:00Z",
};

describe("PlatformAdminActionButtons Component", () => {
  it("renders action buttons for admin role", () => {
    const html = renderToStaticMarkup(
      <PlatformAdminActionButtons
        admin={mockAdminUser}
        onEditAccess={vi.fn()}
        onToggleStatus={vi.fn()}
        onDelete={vi.fn()}
        onVerifyEmail={vi.fn()}
      />,
    );

    expect(html).toContain("platform.editAdminAccess");
    expect(html).toContain("platform.disableAdmin");
    expect(html).toContain("platform.deleteAdmin");
    expect(html).toContain("users.actionVerifyEmail");
  });

  it("returns null for super_user role to protect super admin account", () => {
    const html = renderToStaticMarkup(
      <PlatformAdminActionButtons
        admin={mockSuperUser}
        onEditAccess={vi.fn()}
        onToggleStatus={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(html).toBe("");
  });
});
