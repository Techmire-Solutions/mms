import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FacultyDesignationRolesField } from "./FacultyDesignationRolesField";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/tenant/hooks/useWorkspaceRoles", () => ({
  useWorkspaceRoles: () => [
    {
      id: "staff",
      labelKey: "users.role.staff",
      customLabel: "Staff",
      permissions: {},
      isSystem: true,
    },
    {
      id: "admin",
      labelKey: "users.role.admin",
      customLabel: "Admin",
      permissions: {},
      isSystem: true,
    },
  ],
}));

describe("FacultyDesignationRolesField", () => {
  it("renders a single-role select and create control when permitted", () => {
    const html = renderToStaticMarkup(
      <FacultyDesignationRolesField
        selectedRoleId="staff"
        canCreateRole
        onChange={vi.fn()}
        onOpenCreateRole={vi.fn()}
      />,
    );
    expect(html).toContain("faculty.designations.role");
    expect(html).toContain('id="faculty-designation-role"');
    expect(html).toContain('name="assignableRole"');
    expect(html).toContain('value="staff"');
    expect(html).toContain('value="admin"');
    expect(html).toContain("faculty.designations.addRole");
  });

  it("hides create control when canCreateRole is false", () => {
    const html = renderToStaticMarkup(
      <FacultyDesignationRolesField selectedRoleId="" canCreateRole={false} onChange={vi.fn()} />,
    );
    expect(html).not.toContain("faculty.designations.addRole");
  });

  it("shows select-designation hint when disabled", () => {
    const html = renderToStaticMarkup(
      <FacultyDesignationRolesField selectedRoleId="" disabled onChange={vi.fn()} />,
    );
    expect(html).toContain("faculty.designations.selectDesignationFirst");
  });
});
