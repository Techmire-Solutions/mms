import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RoleCard } from "./AddUserModalRoleCard";
import type { WorkspaceRole } from "@mms/shared";

vi.mock("@/tenant/hooks/useGlobalSettings", () => ({
  useGlobalSettings: () => ({
    enabledModules: ["contacts", "finance", "students"],
  }),
}));

const mockRole: WorkspaceRole = {
  id: "admin",
  labelKey: "users.role.admin",
  descriptionKey: "users.role.adminDesc",
  customLabel: "Administrator",
  customDescription: "Full access to workspace administration",
  isSystem: true,
  badgeVariant: "primary",
  permissions: {
    contacts: ["read", "update", "create", "delete"],
    finance: ["read", "update"],
  },
};

describe("RoleCard Component", () => {
  it("renders with radio role, accessible label, and unselected state", () => {
    const html = renderToStaticMarkup(
      <RoleCard role={mockRole} selected={false} onSelect={vi.fn()} />,
    );

    expect(html).toContain('role="radio"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain("Administrator");
    expect(html).toContain("Full access to workspace administration");
    expect(html).toContain("users.addShowPermissions");
    expect(html).not.toContain("text-primary-foreground");
  });

  it("renders selected state with check icon and aria-checked=true", () => {
    const html = renderToStaticMarkup(
      <RoleCard role={mockRole} selected={true} onSelect={vi.fn()} />,
    );

    expect(html).toContain('role="radio"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("border-primary bg-primary/5");
    expect(html).toContain("text-primary-foreground");
  });
});
