import { describe, expect, it } from "vitest";
import { roleObjectHasPermission } from "./permissions.js";
import { taskInsertSchema, taskUpdateSchema } from "./tasksModuleManifest.js";
import type { WorkspaceRole } from "./userEntityTypes.js";

const manager: WorkspaceRole = {
  id: "manager",
  labelKey: "nav.tasks",
  descriptionKey: "nav.tasks",
  isSystem: false,
  badgeVariant: "primary",
  permissions: { tasks: ["read", "create", "update"] },
};

describe("Tasks capability boundaries", () => {
  it("given a normal task manager, should preserve hierarchy when evaluating elevated permission", () => {
    // Arrange
    const role = manager;

    // Act
    const normal = roleObjectHasPermission(role, "tasks.assign");
    const elevated = roleObjectHasPermission(role, "tasks.assign_anywhere");

    // Assert
    expect(normal).toBe(true);
    expect(elevated).toBe(false);
  });

  it("given an explicit elevated capability, should allow organization-wide assignment", () => {
    // Arrange
    const role: WorkspaceRole = {
      ...manager,
      permissions: { ...manager.permissions, "tasks.assign_anywhere": ["update"] },
    };

    // Act
    const allowed = roleObjectHasPermission(role, "tasks.assign_anywhere");

    // Assert
    expect(allowed).toBe(true);
  });

  it("given server-owned write fields, should reject the request when parsing", () => {
    // Arrange
    const payload = { title: "Task", workspaceSubdomain: "other", deletedAt: null };

    // Act
    const result = taskInsertSchema.safeParse(payload);

    // Assert
    expect(result.success).toBe(false);
  });

  it("given a title-only update, should preserve omitted assignees when parsing", () => {
    // Arrange
    const payload = { title: "Renamed" };

    // Act
    const result = taskUpdateSchema.parse(payload);

    // Assert
    expect(result).toEqual(payload);
  });
});
