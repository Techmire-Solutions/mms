import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * Regression tests for the tenant fail-closed guard shared by every transaction
 * helper.
 *
 * `applyTenantTransactionGuards` sets `app.rls_bypass = 'on'` for a falsy tenant,
 * which makes every tenant RLS policy match ALL rows. `withTenant` guarded that
 * explicitly; `runInTransaction` and `beginLongLivedTenantTransaction` did not,
 * so a background/cron/streaming path that lost its AsyncLocalStorage context
 * silently gained cross-tenant read and write access.
 */
const { getRequestTenantMock } = vi.hoisted(() => ({
  getRequestTenantMock: vi.fn<() => string | null>(() => null),
}));

vi.mock("../lib/tenantContext.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/tenantContext.js")>();
  return { ...actual, getRequestTenant: () => getRequestTenantMock() };
});

vi.mock("../db/dbConnection.js", () => ({
  getActivePoolRole: () => "http",
  getActiveMaxPoolSize: () => 10,
  getPool: () => {
    throw new Error("pool should not be opened when the guard rejects the call");
  },
  getRootDb: () => {
    throw new Error("root db should not be opened when the guard rejects the call");
  },
}));

import {
  beginLongLivedTenantTransaction,
  runInGlobalReadSnapshotTransaction,
  runInGlobalTransaction,
  runInReadSnapshotTransaction,
  runInTransaction,
} from "../db/dbTransactions.js";
import { resolveTenantScope, runWithGlobalTenantScope } from "../db/tenantScopeGuard.js";
import {
  assertRlsRuntimeRole,
  resolveRlsEnforcementMode,
  type RlsEnforcementMode,
} from "../db/rlsRoleGuard.js";

describe("resolveTenantScope", () => {
  it("rejects an empty tenant instead of bypassing RLS", () => {
    for (const empty of [null, undefined, "", "   "]) {
      expect(() => resolveTenantScope(empty, undefined, "runInTransaction")).toThrow(
        /refusing to run with RLS bypassed/,
      );
    }
  });

  it('rejects the literal strings "undefined"/"null"', () => {
    expect(() => resolveTenantScope("undefined", undefined, "x")).toThrow(/literal string/);
    expect(() => resolveTenantScope("null", undefined, "x")).toThrow(/literal string/);
  });

  it("names the caller and the escape hatch", () => {
    expect(() => resolveTenantScope(null, undefined, "beginLongLivedTenantTransaction")).toThrow(
      /beginLongLivedTenantTransaction/,
    );
    expect(() => resolveTenantScope(null, undefined, "runInTransaction")).toThrow(
      /allowGlobal: true/,
    );
  });

  it("returns a trimmed tenant and ignores allowGlobal when a tenant is present", () => {
    expect(resolveTenantScope(" madrasa-a ", { allowGlobal: true }, "x")).toBe("madrasa-a");
    expect(resolveTenantScope("madrasa-a", undefined, "x")).toBe("madrasa-a");
  });

  it("permits an empty tenant only through the explicit opt-in", () => {
    expect(resolveTenantScope(null, { allowGlobal: true }, "x")).toBe("");
  });

  it("honours the boot-time ambient scope used by already-applied data migrations", () => {
    expect(() => resolveTenantScope(null, undefined, "runInTransaction")).toThrow();
    expect(runWithGlobalTenantScope(() => resolveTenantScope(null, undefined, "x"))).toBe("");
    // The scope does not leak out of the callback.
    expect(() => resolveTenantScope(null, undefined, "runInTransaction")).toThrow();
  });
});

describe("transaction helpers fail closed", () => {
  beforeEach(() => getRequestTenantMock.mockReturnValue(null));

  it("runInTransaction refuses to open a bypassing transaction", async () => {
    await expect(runInTransaction(async () => "ran")).rejects.toThrow(
      /refusing to run with RLS bypassed/,
    );
  });

  it("runInReadSnapshotTransaction refuses too", async () => {
    await expect(runInReadSnapshotTransaction(async () => "ran")).rejects.toThrow(
      /refusing to run with RLS bypassed/,
    );
  });

  it("beginLongLivedTenantTransaction rejects a missing tenant at runtime", async () => {
    const looselyTyped = beginLongLivedTenantTransaction as unknown as (
      tenant: string | null,
    ) => Promise<unknown>;
    await expect(looselyTyped(null)).rejects.toThrow(/refusing to run with RLS bypassed/);
    await expect(looselyTyped("undefined")).rejects.toThrow(/literal string/);
  });

  it("the explicit global helpers still require a database (they got past the guard)", async () => {
    // The guard no longer rejects, so the next failure is the absent client —
    // proving the globals are the only way through without a tenant.
    await expect(runInGlobalTransaction(async () => "ran")).rejects.toThrow(
      /Database not initialized/,
    );
    await expect(runInGlobalReadSnapshotTransaction(async () => "ran")).rejects.toThrow(
      /Database not initialized/,
    );
  });
});

describe("RLS runtime role guard", () => {
  const originalMode = process.env.MMS_DB_ROLE_ENFORCEMENT;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalMode === undefined) delete process.env.MMS_DB_ROLE_ENFORCEMENT;
    else process.env.MMS_DB_ROLE_ENFORCEMENT = originalMode;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  const roleDb = (roles: { role: string; is_superuser: boolean; bypass_rls: boolean }) =>
    ({
      execute: async () => [{ ...roles }],
    }) as unknown as Parameters<typeof assertRlsRuntimeRole>[0];

  it("defaults to strict in production and warn elsewhere", () => {
    expect(resolveRlsEnforcementMode(undefined, "production")).toBe("strict");
    expect(resolveRlsEnforcementMode(undefined, "development")).toBe("warn");
    expect(resolveRlsEnforcementMode(undefined, "test")).toBe("warn");
  });

  it("honours an explicit mode", () => {
    expect(resolveRlsEnforcementMode("off", "production")).toBe("off");
    expect(resolveRlsEnforcementMode("WARN", "production")).toBe("warn");
    expect(resolveRlsEnforcementMode("strict", "development")).toBe("strict");
    expect(resolveRlsEnforcementMode("nonsense", "production")).toBe("strict");
  });

  it("passes for a NOSUPERUSER NOBYPASSRLS role", async () => {
    const check = await assertRlsRuntimeRole(
      roleDb({ role: "mms_app", is_superuser: false, bypass_rls: false }),
      { mode: "strict" },
    );
    expect(check.rlsApplies).toBe(true);
  });

  it("refuses to boot as a superuser in strict mode", async () => {
    await expect(
      assertRlsRuntimeRole(roleDb({ role: "postgres", is_superuser: true, bypass_rls: true }), {
        mode: "strict",
      }),
    ).rejects.toThrow(/refusing to start/);
  });

  it("treats BYPASSRLS alone as a bypass", async () => {
    await expect(
      assertRlsRuntimeRole(roleDb({ role: "app", is_superuser: false, bypass_rls: true }), {
        mode: "strict",
      }),
    ).rejects.toThrow(/bypasses row-level security/);
  });

  it("warns instead of throwing in warn mode", async () => {
    const check = await assertRlsRuntimeRole(
      roleDb({ role: "postgres", is_superuser: true, bypass_rls: true }),
      { mode: "warn" as RlsEnforcementMode },
    );
    expect(check.rlsApplies).toBe(false);
  });

  it("does not fail on an inspection error", async () => {
    const broken = {
      execute: async () => {
        throw new Error("catalog unavailable");
      },
    } as unknown as Parameters<typeof assertRlsRuntimeRole>[0];
    const check = await assertRlsRuntimeRole(broken, { mode: "strict" });
    expect(check.role).toBe("unknown");
  });
});
