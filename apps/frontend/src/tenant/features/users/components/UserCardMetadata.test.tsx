import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { SystemUser } from "@mms/shared";
import { UserCardMetadata } from "./UserCardMetadata";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/features/users/hooks/useUsersEntityDescriptor", () => ({
  useUsersEntityDescriptor: () => ({
    getCardFields: () => [
      { key: "role", label: "Role" },
      { key: "status", label: "Status" },
    ],
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

describe("UserCardMetadata Component", () => {
  it("renders metadata fields according to entity descriptor", () => {
    const html = renderToStaticMarkup(
      <UserCardMetadata user={mockUser} formatLoginDate={(d) => d} />,
    );

    expect(html).toContain("Role");
    expect(html).toContain("Status");
  });

  it("filters metadata fields when isColumnVisible is provided", () => {
    const html = renderToStaticMarkup(
      <UserCardMetadata
        user={mockUser}
        formatLoginDate={(d) => d}
        isColumnVisible={(key) => key === "role"}
      />,
    );

    expect(html).toContain("Role");
    expect(html).not.toContain("Status");
  });

  it("returns empty output when no columns are visible", () => {
    const html = renderToStaticMarkup(
      <UserCardMetadata user={mockUser} formatLoginDate={(d) => d} isColumnVisible={() => false} />,
    );

    expect(html).toBe("");
  });
});
