import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  getTenantScopeBypassEvent,
  inTenantScopeBypass,
  inGlobalTenantScope,
  registerTenantScopeBypassSink,
  resetTenantScopeBypassSinksForTesting,
  runWithGlobalTenantScope,
} from "../testing.js";
import { bypassTenantScope } from "../scope.js";
import { resolveTenantScope } from "../tenantScopeGuard.js";

/**
 * Tenant isolation contract:
 * - a missing/empty tenant is rejected unless an explicit ambient scope exists,
 * - `bypassTenantScope` is the only sanctioned ambient scope and it is audited,
 * - the bypass scope is visible to the guard and to nested code.
 */
describe("tenant scope guard", () => {
  it("rejects an empty tenant", () => {
    expect(() => resolveTenantScope(null, undefined, "withTenant")).toThrow(/empty tenant id/);
    expect(() => resolveTenantScope("", undefined, "withTenant")).toThrow(/empty tenant id/);
  });

  it("rejects the literal strings 'undefined' / 'null'", () => {
    expect(() => resolveTenantScope("undefined", undefined, "withTenant")).toThrow(
      /literal string "undefined"/,
    );
    expect(() => resolveTenantScope("null", undefined, "withTenant")).toThrow(
      /literal string "null"/,
    );
  });

  it("accepts a real tenant and the explicit allowGlobal opt-in", () => {
    expect(resolveTenantScope("acme", undefined, "withTenant")).toBe("acme");
    expect(resolveTenantScope(null, { allowGlobal: true }, "withTenant")).toBe("");
  });

  it("accepts the boot-time ambient global scope", () => {
    expect(runWithGlobalTenantScope(() => resolveTenantScope(null, undefined, "migration"))).toBe(
      "",
    );
    expect(inGlobalTenantScope()).toBe(false);
  });
});

describe("bypassTenantScope", () => {
  const events: unknown[] = [];

  beforeEach(() => {
    events.length = 0;
    resetTenantScopeBypassSinksForTesting();
    registerTenantScopeBypassSink((event) => {
      events.push(event);
    });
  });

  afterEach(() => {
    resetTenantScopeBypassSinksForTesting();
  });

  it("requires a reason and an actor id", async () => {
    await expect(
      bypassTenantScope({ reason: "", actorId: "admin-1" }, async () => 1),
    ).rejects.toThrow(/non-empty `reason`/);
    await expect(
      bypassTenantScope({ reason: "provisioning", actorId: "  " }, async () => 1),
    ).rejects.toThrow(/non-empty `actorId`/);
    expect(events).toHaveLength(0);
  });

  it("runs the callback inside the guarded bypass scope and returns its value", async () => {
    const result = await bypassTenantScope(
      {
        reason: "platform provisioning",
        actorId: "platform-admin-7",
        auditMeta: { workspace: "acme" },
      },
      async () => {
        expect(inTenantScopeBypass()).toBe(true);
        expect(getTenantScopeBypassEvent()?.reason).toBe("platform provisioning");
        // the guard now permits an empty tenant inside the audited bypass
        expect(resolveTenantScope(null, undefined, "provisioning")).toBe("");
        return "ok";
      },
    );

    expect(result).toBe("ok");
    expect(inTenantScopeBypass()).toBe(false);
  });

  it("emits a started and a completed audit event with the actor, reason and metadata", async () => {
    await bypassTenantScope(
      { reason: "whole-db backup", actorId: "ops-1", auditMeta: { jobId: "j-9" } },
      async () => undefined,
    );

    const emitted = events as {
      phase: string;
      outcome?: string;
      reason: string;
      actorId: string;
      auditMeta?: Record<string, unknown>;
      bypassId: string;
      durationMs?: number;
    }[];
    expect(emitted.map((event) => event.phase)).toEqual(["started", "completed"]);
    expect(emitted[0]?.reason).toBe("whole-db backup");
    expect(emitted[0]?.actorId).toBe("ops-1");
    expect(emitted[0]?.auditMeta).toEqual({ jobId: "j-9" });
    expect(emitted[0]?.bypassId).toBe(emitted[1]?.bypassId);
    expect(emitted[1]?.outcome).toBe("success");
    expect(typeof emitted[1]?.durationMs).toBe("number");
  });

  it("records the error outcome and rethrows when the callback fails", async () => {
    await expect(
      bypassTenantScope({ reason: "repair", actorId: "ops-2" }, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    const completed = (events as { phase: string; outcome?: string; errorMessage?: string }[])[1];
    expect(completed?.phase).toBe("completed");
    expect(completed?.outcome).toBe("error");
    expect(completed?.errorMessage).toBe("boom");
  });

  it("rejects a nested bypass so the first audit record is never masked", async () => {
    await expect(
      bypassTenantScope({ reason: "outer", actorId: "ops-3" }, async () =>
        bypassTenantScope({ reason: "inner", actorId: "ops-3" }, async () => 1),
      ),
    ).rejects.toThrow(/cannot be nested/);
  });

  it("fails closed when an audit sink throws", async () => {
    registerTenantScopeBypassSink(() => {
      throw new Error("audit sink down");
    });
    await expect(bypassTenantScope({ reason: "x", actorId: "y" }, async () => 1)).rejects.toThrow(
      "audit sink down",
    );
    expect(inTenantScopeBypass()).toBe(false);
  });

  it("logs a structured warning through the default sink even with no registered sink", async () => {
    resetTenantScopeBypassSinksForTesting();
    const warn = vi.fn();
    const { setDbLogger } = await import("../runtime/logger.js");
    setDbLogger({ warn, error: vi.fn() } as never);
    await bypassTenantScope({ reason: "default sink", actorId: "ops-4" }, async () => undefined);
    expect(warn).toHaveBeenCalled();
  });
});
