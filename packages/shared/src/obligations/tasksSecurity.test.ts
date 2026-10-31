import { describe, expect, it } from "vitest";
import { roleObjectHasPermission } from "../auth/permissions.js";
import { taskInsertSchema, taskListQuerySchema, taskUpdateSchema } from "./tasksModuleManifest.js";
import type { WorkspaceRole } from "../auth/userEntityTypes.js";

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

  it("given dueFrom and dueTo query parameters, should parse successfully", () => {
    // Arrange
    const query = {
      dueFrom: "2026-10-01",
      dueTo: "2026-10-31T23:59:59.999Z",
      status: "in_progress",
    };

    // Act
    const result = taskListQuerySchema.safeParse(query);

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dueFrom).toBe("2026-10-01");
      expect(result.data.dueTo).toBe("2026-10-31T23:59:59.999Z");
      expect(result.data.status).toBe("in_progress");
      expect(result.data.limit).toBe(50);
      expect(result.data.offset).toBe(0);
    }
  });

  it("given unallowed query properties, should reject due to strict schema", () => {
    // Arrange
    const invalidQuery = {
      unknownField: "malicious_or_accidental",
    };

    // Act
    const result = taskListQuerySchema.safeParse(invalidQuery);

    // Assert
    expect(result.success).toBe(false);
  });
});
