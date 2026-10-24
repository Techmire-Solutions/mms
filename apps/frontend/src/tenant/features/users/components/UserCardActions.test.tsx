import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { SystemUser } from "@mms/shared";
import { UserCardActions } from "./UserCardActions";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (params?.name) return `${key}:${params.name}`;
      return key;
    },
  }),
}));

const mockUser: SystemUser = {
  id: "usr-1",
  name: "Admin User",
  email: "admin@madrasa.com",
  phone: "+1234567890",
  role: "admin",
  status: "active",
  lastLogin: "2024-01-01T00:00:00Z",
  createdDate: "2024-01-01T00:00:00Z",
  twoFactorEnabled: false,
  failedLoginAttempts: 0,
  activeSessions: 1,
  avatarInitials: "AU",
};

describe("UserCardActions Component", () => {
  it("renders view action button with localized label and aria-label", () => {
    const html = renderToStaticMarkup(
      <UserCardActions
        user={mockUser}
        canWrite={true}
        canDelete={true}
        showDeleted={false}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onRestore={vi.fn()}
        onResetPassword={vi.fn()}
      />,
    );

    expect(html).toContain("users.actionViewShort");
    expect(html).toContain('aria-label="users.actionView:Admin User"');
    expect(html).toContain('aria-label="users.actionEdit:Admin User"');
    expect(html).toContain('aria-label="users.actionResetPassword:Admin User"');
    expect(html).toContain('aria-label="users.trash.delete:Admin User"');
  });

  it("renders restore action instead of delete when showDeleted is true", () => {
    const html = renderToStaticMarkup(
      <UserCardActions
        user={mockUser}
        canWrite={true}
        canDelete={true}
        showDeleted={true}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onRestore={vi.fn()}
        onResetPassword={vi.fn()}
      />,
    );

    expect(html).toContain('aria-label="users.trash.restore"');
    expect(html).not.toContain('aria-label="users.actionEdit:Admin User"');
  });
});
