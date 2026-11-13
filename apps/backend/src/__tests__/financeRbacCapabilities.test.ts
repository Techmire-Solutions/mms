import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACCOUNTING_MODULE_MANIFEST,
  FINANCE_MODULE_MANIFEST,
  evaluateModuleAccess,
  roleHasPermission,
  type User,
  type WorkspaceRole,
} from "@mms/shared";
import { canManageAccounting, canManageFinance } from "../lib/rbacCanHelpers.js";

vi.mock("../db/database.js", () => ({
  initDb: vi.fn().mockResolvedValue(undefined),
  pingDatabase: vi.fn().mockResolvedValue(true),
}));

/**
 * Capability matrix for the Finance/Accounting module.
 *
 * The gate maps a route action to a manifest permission; these assertions pin the
 * separation the audit introduced:
 *   - read: auditors and principals can inspect financial records,
 *   - write: cashiers/billing post payments, drafts, vouchers and revaluations,
 *   - manage: controllers/admins close periods, waive/cancel and renumber vouchers,
 *   - delete: archive/restore is its own capability.
 */
const availability = {
  finance: { granted: true, enabled: true },
  accounting: { granted: true, enabled: true },
};

function user(role: string): User {
  return { id: "u-1", role, workspaceSubdomain: "demo" } as User;
}

function canAs(role: string) {
  return (permission: Parameters<typeof roleHasPermission>[1]) =>
    roleHasPermission(role, permission);
}

describe("finance/accounting capability matrix", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lets read-only roles read finance (auditor, principal)", () => {
    for (const role of ["auditor", "principal"]) {
      const decision = evaluateModuleAccess({
        moduleId: "finance",
        availability,
        action: "read",
        can: canAs(role),
      });
      expect(decision, role).toMatchObject({ allowed: true });
      expect(roleHasPermission(role, FINANCE_MODULE_MANIFEST.permissions.read)).toBe(true);
    }
  });

  it("keeps the accountant able to write payments, drafts, vouchers and revaluations", () => {
    for (const [moduleId, action] of [
      ["finance", "write"],
      ["accounting", "write"],
    ] as const) {
      const decision = evaluateModuleAccess({
        moduleId,
        availability,
        action,
        can: canAs("accountant"),
      });
      expect(decision, `${moduleId}.${action}`).toMatchObject({ allowed: true });
    }
  });

  it("denies the accountant the privileged actions (close, waive, renumber)", () => {
    for (const [moduleId, action] of [
      ["finance", "manage"],
      ["accounting", "manage"],
    ] as const) {
      const decision = evaluateModuleAccess({
        moduleId,
        availability,
        action,
        can: canAs("accountant"),
      });
      expect(decision, `${moduleId}.${action}`).toMatchObject({
        allowed: false,
        code: "PERMISSION_DENIED",
      });
    }
    expect(roleHasPermission("accountant", "finance.manage")).toBe(false);
    expect(roleHasPermission("accountant", "accounting.manage")).toBe(false);
  });

  it("grants admins the privileged actions", () => {
    expect(roleHasPermission("admin", "finance.manage")).toBe(true);
    expect(roleHasPermission("admin", "accounting.manage")).toBe(true);
    expect(roleHasPermission("super_admin", "accounting.manage")).toBe(true);
  });

  it("distinguishes delete from write for finance and accounting", () => {
    expect(roleHasPermission("accountant", FINANCE_MODULE_MANIFEST.permissions.delete)).toBe(true);
    // A custom write-only role must not be able to archive financial records.
    const writeOnly: WorkspaceRole = {
      id: "cashier_c1",
      labelKey: "nav.finance",
      descriptionKey: "nav.finance",
      isSystem: false,
      badgeVariant: "primary",
      permissions: { finance: ["create", "update"], accounting: ["create", "update"] },
    };
    const can = (permission: Parameters<typeof roleHasPermission>[1]) =>
      roleHasPermission(writeOnly.id, permission, [writeOnly]);
    expect(can(FINANCE_MODULE_MANIFEST.permissions.write)).toBe(true);
    expect(can(FINANCE_MODULE_MANIFEST.permissions.delete)).toBe(false);
    expect(can(FINANCE_MODULE_MANIFEST.permissions.manage)).toBe(false);
    expect(can(ACCOUNTING_MODULE_MANIFEST.permissions.delete)).toBe(false);
  });

  it("recognises a controller custom role with manage only", () => {
    const controller: WorkspaceRole = {
      id: "finance_controller_c1",
      labelKey: "nav.finance",
      descriptionKey: "nav.finance",
      isSystem: false,
      badgeVariant: "primary",
      permissions: { finance: ["read", "manage"], accounting: ["read", "manage"] },
    };
    const can = (permission: Parameters<typeof roleHasPermission>[1]) =>
      roleHasPermission(controller.id, permission, [controller]);
    expect(can("finance.manage")).toBe(true);
    expect(can("accounting.manage")).toBe(true);
    expect(can("finance.write")).toBe(false);
  });

  it("keeps guardians and students out of finance/accounting", () => {
    for (const role of ["guardian", "student", "teacher"]) {
      for (const [moduleId, action] of [
        ["finance", "read"],
        ["accounting", "read"],
      ] as const) {
        const decision = evaluateModuleAccess({
          moduleId,
          availability,
          action,
          can: canAs(role),
        });
        expect(decision, `${role}:${moduleId}`).toMatchObject({
          allowed: false,
          code: "PERMISSION_DENIED",
        });
      }
    }
  });
});

describe("handler-level manage helpers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("gate the privileged routes by the manage capability", () => {
    expect(canManageFinance(user("admin"))).toBe(true);
    expect(canManageFinance(user("accountant"))).toBe(false);
    expect(canManageFinance(user("auditor"))).toBe(false);
    expect(canManageFinance(user("guardian"))).toBe(false);
    expect(canManageAccounting(user("admin"))).toBe(true);
    expect(canManageAccounting(user("accountant"))).toBe(false);
    expect(canManageAccounting(user("auditor"))).toBe(false);
  });
});
