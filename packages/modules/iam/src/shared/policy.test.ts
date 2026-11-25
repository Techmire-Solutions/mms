import { describe, expect, it } from "vitest";
import {
  assertCanManageMember,
  assertPlatformActionReason,
  assertLastAdminRetained,
  assertPlatformIamAccess,
  canSuspendTenantUser,
  inviteStatus,
  lastAdminViolation,
  PLATFORM_ADMIN_PERMISSION,
  PLATFORM_SUPER_USER_ROLE,
} from "./index.js";
import type { IamMemberSummary, IamPlatformActor } from "./types.js";

const member = (over: Partial<IamMemberSummary>): IamMemberSummary => ({
  id: "u1",
  name: "User",
  email: "u@example.com",
  role: "teacher",
  status: "active",
  ...over,
});

describe("IAM shared policy", () => {
  it("blocks removing the last active administrator", () => {
    const members = [member({ id: "a", role: "admin" }), member({ id: "t", role: "teacher" })];
    expect(lastAdminViolation(members, "a", "suspended")).toBe(true);
    expect(() => assertLastAdminRetained(members, "a", "suspended")).toThrow(/last active/);
  });

  it("allows administration when another active admin remains", () => {
    const members = [member({ id: "a1", role: "admin" }), member({ id: "a2", role: "admin" })];
    expect(lastAdminViolation(members, "a1", "suspended")).toBe(false);
  });

  it("delegates member management to the contract role policy", () => {
    expect(() => assertCanManageMember("teacher", "teacher")).toThrow();
    expect(() => assertCanManageMember("admin", "teacher")).not.toThrow();
    expect(() => assertCanManageMember("admin", "super_admin")).toThrow();
  });

  it("requires a bounded impersonation reason", () => {
    expect(() => assertPlatformActionReason("short")).toThrow();
    expect(assertPlatformActionReason("  platform support investigation  ")).toBe(
      "platform support investigation",
    );
  });

  it("requires admins and super_user for sensitive platform IAM", () => {
    const actor = {
      id: "p1",
      role: "admin",
      permissions: {
        admins: true,
        workspaces: false,
        onboard: false,
        settings: false,
        system: false,
        contacts: false,
        messaging: false,
      },
      name: "Operator",
      email: "op@example.com",
    } satisfies IamPlatformActor;
    expect(() => assertPlatformIamAccess(actor)).not.toThrow();
    expect(() => assertPlatformIamAccess(actor, { requireSuperUser: true })).toThrow();
    expect(() =>
      assertPlatformIamAccess(
        { ...actor, permissions: { ...actor.permissions, admins: false } },
        {},
      ),
    ).toThrow();
  });

  it("derives pending/active/expired invite states", () => {
    expect(inviteStatus({ createdAt: new Date().toISOString() })).toBe("pending");
    expect(inviteStatus({ lastLogin: new Date().toISOString() })).toBe("active");
    expect(inviteStatus({ createdAt: "2020-01-01T00:00:00Z" })).toBe("expired");
  });

  it("blocks demoting the last active admin and ignores inactive/deleted admins", () => {
    expect(lastAdminViolation([member({ id: "a", role: "admin" })], "a", "inactive")).toBe(true);
    const withDormant = [
      member({ id: "a", role: "admin" }),
      member({ id: "b", role: "admin", status: "inactive" }),
      member({ id: "c", role: "admin", deletedAt: "2026-01-01T00:00:00Z" }),
    ];
    expect(lastAdminViolation(withDormant, "a", "suspended")).toBe(true);
  });

  it("refuses self-suspension and platform-managed targets", () => {
    const actor = { id: "a1", role: "admin" };
    expect(canSuspendTenantUser(actor, member({ id: "a1", role: "admin" }))).toBe(false);
    expect(canSuspendTenantUser(actor, member({ id: "s", role: "super_admin" }))).toBe(false);
    expect(canSuspendTenantUser(actor, member({ id: "t", role: "teacher" }))).toBe(true);
    expect(
      canSuspendTenantUser({ id: "t1", role: "teacher" }, member({ id: "t2", role: "teacher" })),
    ).toBe(false);
  });

  it("bounds the impersonation reason at 10–500 characters", () => {
    expect(() => assertPlatformActionReason("123456789")).toThrow();
    expect(assertPlatformActionReason("1234567890")).toBe("1234567890");
    expect(assertPlatformActionReason("x".repeat(500))).toHaveLength(500);
    expect(() => assertPlatformActionReason("x".repeat(501))).toThrow();
  });

  it("gates sensitive platform IAM on the super_user role plus the admins permission", () => {
    const superUser = {
      id: "p0",
      role: PLATFORM_SUPER_USER_ROLE,
      permissions: {
        [PLATFORM_ADMIN_PERMISSION]: true,
        workspaces: false,
        onboard: false,
        settings: false,
        system: false,
        contacts: false,
        messaging: false,
      },
      name: "Super",
      email: "super@example.com",
    } satisfies IamPlatformActor;
    expect(() => assertPlatformIamAccess(superUser, { requireSuperUser: true })).not.toThrow();
    const delegatedAdmin = {
      ...superUser,
      role: "admin" as const,
      permissions: { ...superUser.permissions, [PLATFORM_ADMIN_PERMISSION]: true },
    };
    expect(() => assertPlatformIamAccess(delegatedAdmin)).not.toThrow();
    expect(() => assertPlatformIamAccess(delegatedAdmin, { requireSuperUser: true })).toThrow(
      /Super-user/,
    );
    expect(() =>
      assertPlatformIamAccess(
        { ...delegatedAdmin, permissions: { ...delegatedAdmin.permissions, admins: false } },
        {},
      ),
    ).toThrow(/admins/);
  });
});
