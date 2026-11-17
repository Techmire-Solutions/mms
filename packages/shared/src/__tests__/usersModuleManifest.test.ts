import { describe, expect, it } from "vitest";
import {
  editWorkspaceUserSchema,
  inviteWorkspaceUserSchema,
  createWorkspaceUserSchema,
  resetWorkspaceUserPasswordSchema,
  workspaceUserRecordSchema,
  workspaceUserBulkUpdateRowSchema,
  bulkUpdateWorkspaceUsersSchema,
  activityLogRecordSchema,
  USERS_MODULE_MANIFEST,
} from "../auth/usersModuleManifest.js";
import { workspaceRolePersistedSchema } from "../auth/userRbacRoleWrite.js";

describe("workspace user form schemas", () => {
  it("accepts valid edit and invite values", () => {
    expect(
      editWorkspaceUserSchema.safeParse({
        contactId: "contact-1",
        role: "admin",
        status: "active",
        twoFactorEnabled: true,
      }).success,
    ).toBe(true);

    expect(
      inviteWorkspaceUserSchema.safeParse({
        contactId: 42,
        role: "teacher",
        status: "inactive",
        sendEmail: true,
      }).success,
    ).toBe(true);
  });

  it("accepts valid create form values for both invite and password setup methods", () => {
    expect(
      createWorkspaceUserSchema.safeParse({
        contactId: "contact-1",
        role: "staff",
        status: "active",
        setupMethod: "invite",
        twoFactorEnabled: false,
      }).success,
    ).toBe(true);

    expect(
      createWorkspaceUserSchema.safeParse({
        contactId: "contact-2",
        role: "admin",
        status: "active",
        setupMethod: "password",
        password: "TemporaryPassword123!",
        forceReset: true,
        twoFactorEnabled: true,
      }).success,
    ).toBe(true);
  });

  it("validates reset password input", () => {
    expect(
      resetWorkspaceUserPasswordSchema.safeParse({
        temporaryPassword: "NewPassword123!",
      }).success,
    ).toBe(true);

    expect(
      resetWorkspaceUserPasswordSchema.safeParse({
        temporaryPassword: "",
      }).success,
    ).toBe(false);
  });

  it("rejects missing contacts and roles", () => {
    const result = inviteWorkspaceUserSchema.safeParse({
      contactId: "",
      role: "",
      status: "active",
      sendEmail: false,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toEqual(
        expect.arrayContaining(["users.addErrorContact", "users.errorRoleRequired"]),
      );
    }
  });

  it("validates workspace user records with default fallbacks and passthrough fields", () => {
    const parsed = workspaceUserRecordSchema.parse({
      id: "u-1",
      name: "Test User",
      email: "test@example.com",
      role: "admin",
      customAttribute: "extra-field",
    });

    expect(parsed.id).toBe("u-1");
    expect(parsed.status).toBe("active");
    expect(parsed.twoFactorEnabled).toBe(false);
    expect((parsed as any).customAttribute).toBe("extra-field");
  });

  it("bulk update schema strips credential and lifecycle fields", () => {
    const parsed = bulkUpdateWorkspaceUsersSchema.parse([
      {
        id: "u-1",
        name: "Test User",
        email: "test@example.com",
        phone: "3001234567",
        contactId: "c-1",
        role: "admin",
        status: "active",
        twoFactorEnabled: false,
        temporaryPassword: "Hacked123!",
        passwordHash: "injected-hash",
        deletedAt: "2026-01-01T00:00:00Z",
        deletedBy: "u-evil",
        workspaceSubdomain: "other",
        profileJson: { evil: true },
      },
    ]);

    const [row] = parsed;
    expect(row).toEqual({
      id: "u-1",
      name: "Test User",
      email: "test@example.com",
      phone: "3001234567",
      contactId: "c-1",
      role: "admin",
      status: "active",
      twoFactorEnabled: false,
    });
    expect(row).not.toHaveProperty("temporaryPassword");
    expect(row).not.toHaveProperty("passwordHash");
    expect(row).not.toHaveProperty("deletedAt");
    expect(row).not.toHaveProperty("deletedBy");
    expect(row).not.toHaveProperty("workspaceSubdomain");
    expect(row).not.toHaveProperty("profileJson");

    // Omitted optional fields are simply absent (no defaults), so an omitted
    // `status` cannot silently reactivate or downgrade a user.
    const noStatus = workspaceUserBulkUpdateRowSchema.parse({
      id: "u-2",
      name: "No Status",
      email: "nostatus@example.com",
      role: "teacher",
    });
    expect(noStatus).not.toHaveProperty("status");
    expect(noStatus).not.toHaveProperty("twoFactorEnabled");
  });

  it("validates activity log entries", () => {
    const parsed = activityLogRecordSchema.parse({
      id: "log-1",
      userId: "u-1",
      action: "create",
      module: "users",
      detail: "Created user",
      ts: "2026-09-02T00:00:00Z",
      ip: "127.0.0.1",
    });

    expect(parsed.action).toBe("create");
  });

  it("has valid USERS_MODULE_MANIFEST structure", () => {
    expect(USERS_MODULE_MANIFEST.moduleId).toBe("users");
    expect(USERS_MODULE_MANIFEST.tiers).toEqual(["work", "reports", "setup"]);
    expect(USERS_MODULE_MANIFEST.restBasePath).toBe("/api/users");
  });

  it("workspaceRolePersistedSchema accepts valid roles and rejects malformed ones", () => {
    const parsed = workspaceRolePersistedSchema.parse({
      id: "custom-1",
      permissions: { users: ["read", "create"] },
      customLabel: "My Role",
      isSystem: false,
    });
    expect(parsed.id).toBe("custom-1");
    expect(parsed.permissions).toEqual({ users: ["read", "create"] });
    expect(parsed.customLabel).toBe("My Role");

    expect(workspaceRolePersistedSchema.safeParse({ id: 123, permissions: {} }).success).toBe(
      false,
    );
    expect(
      workspaceRolePersistedSchema.safeParse({ id: "x", permissions: "not-a-record" }).success,
    ).toBe(false);
    expect(
      workspaceRolePersistedSchema.safeParse({ id: "x", permissions: { users: "not-an-array" } })
        .success,
    ).toBe(false);
  });
});
