import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { SystemUser } from "@mms/shared";
import { UsersListCards } from "@/tenant/features/users/components/UsersListCards";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.count !== undefined) return `${key}:${params.count}`;
      if (params?.name) return `${key}:${params.name}`;
      return key;
    },
  }),
}));

const mockUsers: SystemUser[] = [
  {
    id: "usr-1",
    name: "Admin User",
    email: "admin@madrasa.com",
    phone: "+1234567890",
    role: "admin",
    status: "active",
    lastLogin: "2024-01-01T00:00:00Z",
    createdDate: "2024-01-01T00:00:00Z",
    twoFactorEnabled: true,
    failedLoginAttempts: 0,
    activeSessions: 1,
    avatarInitials: "AU",
  },
  {
    id: "usr-2",
    name: "Teacher User",
    email: "teacher@madrasa.com",
    phone: "+1987654321",
    role: "teacher",
    status: "inactive",
    lastLogin: "2024-01-02T00:00:00Z",
    createdDate: "2024-01-02T00:00:00Z",
    twoFactorEnabled: false,
    failedLoginAttempts: 0,
    activeSessions: 0,
    avatarInitials: "TU",
    deletedAt: "2024-01-03T00:00:00Z",
  },
];

describe("UsersListCards", () => {
  it("renders a list of user cards with user details, 2FA badges, and metadata", () => {
    const html = renderToStaticMarkup(
      <UsersListCards
        users={mockUsers}
        selectedIds={["usr-1"]}
        allSelected={false}
        someSelected={true}
        canWrite={true}
        canDelete={true}
        showDeleted={false}
        formatLoginDate={(d) => `Formatted: ${d}`}
        onToggleSelect={vi.fn()}
        onToggleAll={vi.fn()}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onRestore={vi.fn()}
        onResetPassword={vi.fn()}
      />,
    );

    expect(html).toContain("Admin User");
    expect(html).toContain("admin@madrasa.com");
    expect(html).toContain("Teacher User");
    expect(html).toContain("teacher@madrasa.com");
    expect(html).toContain("users-cards");
    expect(html).toContain("users.twoFactorOn");
    expect(html).toContain("users.twoFactorOff");
    expect(html).toContain("users.selectedCount:1");
  });

  it("renders archived banner and restore action for deleted users when showDeleted is true", () => {
    const html = renderToStaticMarkup(
      <UsersListCards
        users={mockUsers}
        selectedIds={[]}
        allSelected={false}
        someSelected={false}
        canWrite={true}
        canDelete={true}
        showDeleted={true}
        formatLoginDate={(d) => `Formatted: ${d}`}
        onToggleSelect={vi.fn()}
        onToggleAll={vi.fn()}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onRestore={vi.fn()}
        onResetPassword={vi.fn()}
      />,
    );

    expect(html).toContain("Teacher User");
    expect(html).toContain("users.trash.restore");
  });

  it("hides selection checkboxes and write actions when permissions are disabled", () => {
    const html = renderToStaticMarkup(
      <UsersListCards
        users={mockUsers}
        selectedIds={[]}
        allSelected={false}
        someSelected={false}
        canWrite={false}
        canDelete={false}
        showDeleted={false}
        formatLoginDate={(d) => `Formatted: ${d}`}
        onToggleSelect={vi.fn()}
        onToggleAll={vi.fn()}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onRestore={vi.fn()}
        onResetPassword={vi.fn()}
      />,
    );

    expect(html).not.toContain('role="checkbox"');
    expect(html).not.toContain("common.edit");
    expect(html).not.toContain("common.delete");
  });

  it("respects isColumnVisible by omitting email and disabled metadata columns", () => {
    const html = renderToStaticMarkup(
      <UsersListCards
        users={mockUsers}
        selectedIds={[]}
        allSelected={false}
        someSelected={false}
        canWrite={true}
        canDelete={true}
        showDeleted={false}
        formatLoginDate={(d) => `Formatted: ${d}`}
        onToggleSelect={vi.fn()}
        onToggleAll={vi.fn()}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onRestore={vi.fn()}
        onResetPassword={vi.fn()}
        isColumnVisible={(key) => key === "role"}
      />,
    );

    expect(html).toContain("Admin User");
    expect(html).not.toContain("admin@madrasa.com");
    expect(html).not.toContain("users.twoFactorOn");
  });

  it("handles empty users list without errors", () => {
    const html = renderToStaticMarkup(
      <UsersListCards
        users={[]}
        selectedIds={[]}
        allSelected={false}
        someSelected={false}
        canWrite={true}
        canDelete={true}
        showDeleted={false}
        formatLoginDate={(d) => `Formatted: ${d}`}
        onToggleSelect={vi.fn()}
        onToggleAll={vi.fn()}
        onView={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onRestore={vi.fn()}
        onResetPassword={vi.fn()}
      />,
    );

    expect(html).not.toContain("Admin User");
  });
});
