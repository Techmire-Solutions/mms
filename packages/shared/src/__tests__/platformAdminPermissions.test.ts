import { describe, expect, it } from "vitest";
import {
  platformCreateAdminBodySchema,
  platformUpdateAdminPermissionsBodySchema,
  platformWorkspaceRowDtoSchema,
  PLATFORM_WORKSPACE_ROW_SECRET_KEYS,
} from "../platformSchemas.js";
import {
  DEFAULT_PLATFORM_ADMIN_PERMISSIONS,
  FULL_PLATFORM_ADMIN_PERMISSIONS,
  PLATFORM_ADMIN_PERMISSION_KEYS,
  normalizePlatformAdminPermissions,
  platformUserCan,
  PLATFORM_MIN_PASSWORD_LENGTH,
} from "../platformTypes.js";

describe("PLATFORM_ADMIN_PERMISSION_KEYS", () => {
  it("matches the DB CHECK allowlist and permission flag keys", () => {
    expect([...PLATFORM_ADMIN_PERMISSION_KEYS]).toEqual([
      "workspaces",
      "onboard",
      "settings",
      "admins",
      "system",
    ]);
    expect(Object.keys(DEFAULT_PLATFORM_ADMIN_PERMISSIONS).sort()).toEqual(
      [...PLATFORM_ADMIN_PERMISSION_KEYS].sort(),
    );
  });
});

describe("platformUserCan", () => {
  it("grants all capabilities to super_user", () => {
    const user = {
      role: "super_user" as const,
      permissions: DEFAULT_PLATFORM_ADMIN_PERMISSIONS,
    };
    expect(platformUserCan(user, "workspaces")).toBe(true);
    expect(platformUserCan(user, "onboard")).toBe(true);
  });

  it("uses admin permission flags", () => {
    const user = {
      role: "admin" as const,
      permissions: {
        workspaces: true,
        onboard: false,
        settings: false,
        admins: false,
        system: false,
      },
    };
    expect(platformUserCan(user, "workspaces")).toBe(true);
    expect(platformUserCan(user, "onboard")).toBe(false);
  });

  it("denies when user is missing", () => {
    expect(platformUserCan(null, "workspaces")).toBe(false);
    expect(platformUserCan(undefined, "onboard")).toBe(false);
  });
});

describe("normalizePlatformAdminPermissions", () => {
  it("defaults unknown values to false flags", () => {
    expect(normalizePlatformAdminPermissions(null)).toEqual(DEFAULT_PLATFORM_ADMIN_PERMISSIONS);
    expect(normalizePlatformAdminPermissions({ workspaces: true })).toEqual({
      workspaces: true,
      onboard: false,
      settings: false,
      admins: false,
      system: false,
    });
  });
});

describe("platform admin permission schemas", () => {
  it("defaults permissions on create when omitted", () => {
    const valid = platformCreateAdminBodySchema.safeParse({
      name: "Admin User",
      email: "admin2@madrasa.org",
      password: "Password123456",
      currentPassword: "OperatorPass123",
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.permissions).toEqual(DEFAULT_PLATFORM_ADMIN_PERMISSIONS);
    }
    expect(PLATFORM_MIN_PASSWORD_LENGTH).toBeGreaterThanOrEqual(10);
  });

  it("accepts explicit permissions on create and update", () => {
    const create = platformCreateAdminBodySchema.safeParse({
      name: "Admin User",
      email: "admin2@madrasa.org",
      password: "Password123456",
      currentPassword: "OperatorPass123",
      permissions: FULL_PLATFORM_ADMIN_PERMISSIONS,
    });
    expect(create.success).toBe(true);

    const update = platformUpdateAdminPermissionsBodySchema.safeParse({
      permissions: {
        workspaces: false,
        onboard: true,
        settings: false,
        admins: false,
        system: false,
      },
      password: "OperatorPass123",
    });
    expect(update.success).toBe(true);
  });

  it("rejects create/update without operator password step-up", () => {
    expect(
      platformCreateAdminBodySchema.safeParse({
        name: "Admin User",
        email: "admin2@madrasa.org",
        password: "Password123456",
      }).success,
    ).toBe(false);
    expect(
      platformUpdateAdminPermissionsBodySchema.safeParse({
        permissions: FULL_PLATFORM_ADMIN_PERMISSIONS,
      }).success,
    ).toBe(false);
  });
});

describe("platformWorkspaceRowDtoSchema", () => {
  it("omits LLM and credential secret keys from the list DTO shape", () => {
    const shapeKeys = Object.keys(platformWorkspaceRowDtoSchema.shape);
    for (const key of PLATFORM_WORKSPACE_ROW_SECRET_KEYS) {
      expect(shapeKeys).not.toContain(key);
    }
    const parsed = platformWorkspaceRowDtoSchema.safeParse({
      subdomain: "demo",
      enabled: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      llmApiKey: "sk-leak",
    });
    expect(parsed.success).toBe(false);
  });
});
