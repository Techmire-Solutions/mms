import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { SystemUser } from "@mms/shared";
import { UserCardHeader } from "@/tenant/features/users/components/UserCardHeader";

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

describe("UserCardHeader", () => {
  it("renders user name and email by default when isColumnVisible is omitted", () => {
    const html = renderToStaticMarkup(
      <UserCardHeader
        user={mockUser}
        isSelected={false}
        showSelect={true}
        onToggleSelect={vi.fn()}
        onView={vi.fn()}
      />,
    );

    expect(html).toContain("Admin User");
    expect(html).toContain("admin@madrasa.com");
    expect(html).toContain('aria-label="users.selectRow:Admin User"');
  });

  it("renders email when email column is explicitly visible", () => {
    const html = renderToStaticMarkup(
      <UserCardHeader
        user={mockUser}
        isSelected={false}
        showSelect={true}
        onToggleSelect={vi.fn()}
        onView={vi.fn()}
        isColumnVisible={(key) => key === "email"}
      />,
    );

    expect(html).toContain("Admin User");
    expect(html).toContain("admin@madrasa.com");
  });

  it("hides email subtitle when email column is not visible", () => {
    const html = renderToStaticMarkup(
      <UserCardHeader
        user={mockUser}
        isSelected={false}
        showSelect={true}
        onToggleSelect={vi.fn()}
        onView={vi.fn()}
        isColumnVisible={(key) => key !== "email"}
      />,
    );

    expect(html).toContain("Admin User");
    expect(html).not.toContain("admin@madrasa.com");
  });

  it("hides checkbox when showSelect is false", () => {
    const html = renderToStaticMarkup(
      <UserCardHeader
        user={mockUser}
        isSelected={false}
        showSelect={false}
        onToggleSelect={vi.fn()}
        onView={vi.fn()}
      />,
    );

    expect(html).not.toContain('role="checkbox"');
  });

  it("marks checkbox as checked when isSelected is true", () => {
    const html = renderToStaticMarkup(
      <UserCardHeader
        user={mockUser}
        isSelected={true}
        showSelect={true}
        onToggleSelect={vi.fn()}
        onView={vi.fn()}
      />,
    );

    expect(html).toContain('aria-checked="true"');
  });

  it("handles blank email gracefully without rendering empty subtitle", () => {
    const userWithoutEmail: SystemUser = {
      ...mockUser,
      email: "",
    };

    const html = renderToStaticMarkup(
      <UserCardHeader
        user={userWithoutEmail}
        isSelected={false}
        showSelect={true}
        onToggleSelect={vi.fn()}
        onView={vi.fn()}
      />,
    );

    expect(html).toContain("Admin User");
    expect(html).not.toContain(
      'class="mt-0.5 text-xs font-semibold text-muted-foreground truncate"',
    );
  });
});
