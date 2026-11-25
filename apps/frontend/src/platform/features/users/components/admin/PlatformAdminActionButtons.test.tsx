import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlatformAdminActionButtons } from "@/platform/features/users/components/admin/PlatformAdminActionButtons";
import type { PlatformUserProfile } from "@mms/contracts";
import {
  DEFAULT_PLATFORM_ADMIN_PERMISSIONS,
  FULL_PLATFORM_ADMIN_PERMISSIONS,
} from "@mms/contracts";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

let mockIsSuperUser = true;
vi.mock("@/platform/hooks/usePlatformPermissions", () => ({
  usePlatformPermissions: () => ({ isSuperUser: mockIsSuperUser }),
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
  it("renders action buttons for admin role when the actor is a super-user", () => {
    mockIsSuperUser = true;
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

  it("hides management actions from a non-super-user operator (verify email only)", () => {
    mockIsSuperUser = false;
    const html = renderToStaticMarkup(
      <PlatformAdminActionButtons
        admin={mockAdminUser}
        onEditAccess={vi.fn()}
        onToggleStatus={vi.fn()}
        onDelete={vi.fn()}
        onVerifyEmail={vi.fn()}
      />,
    );

    expect(html).toContain("users.actionVerifyEmail");
    expect(html).not.toContain("platform.editAdminAccess");
    expect(html).not.toContain("platform.disableAdmin");
    expect(html).not.toContain("platform.deleteAdmin");
  });

  it("returns null for super_user role to protect super admin account", () => {
    mockIsSuperUser = true;
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
