import { describe, expect, it } from "vitest";
import {
  editWorkspaceUserSchema,
  inviteWorkspaceUserSchema,
  createWorkspaceUserSchema,
  resetWorkspaceUserPasswordSchema,
  workspaceUserRecordSchema,
  activityLogRecordSchema,
  USERS_MODULE_MANIFEST,
} from "../usersModuleManifest.js";

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
});
