/**
 * Centralized tenant-scope enforcement and the audited platform bypass.
 *
 * Default posture: **fail closed**. Every tenant-scoped transaction resolves its
 * tenant through `resolveTenantScope()` (tenantScopeGuard) which refuses an empty
 * tenant unless the caller is inside an explicit ambient scope. RLS is then
 * applied per transaction by `applyTenantTransactionGuards`
 * (`SET LOCAL app.current_tenant`).
 *
 * The only sanctioned way to run without a tenant is `bypassTenantScope()`:
 *
 * ```ts
 * await bypassTenantScope(
 *   { reason: "platform workspace provisioning", actorId: platformUserId, auditMeta: { workspaceId } },
 *   () => runProvisioningTransaction(),
 * );
 * ```
 *
 * Every invocation is audited through the registered sinks. The always-on sink
 * writes a structured `warn` through the data-layer logger with the full event;
 * platform services may register an additional sink (for example an audit-trail
 * writer) via `registerTenantScopeBypassSink`. Sink failures propagate: an
 * unauditable bypass must not silently proceed.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { getDbLogger } from "./runtime/logger.js";

export interface TenantScopeBypassOptions {
  /** Why this operation is allowed to run outside a tenant. Required, non-empty. */
  reason: string;
  /** Who invoked it (platform user id / service actor id). Required, non-empty. */
  actorId: string;
  /** Extra audit metadata (workspace id, request id, correlation id, …). */
  auditMeta?: Record<string, unknown>;
}

export interface TenantScopeBypassEvent {
  type: "tenant_scope.bypassed";
  /** Stable id correlating the started/completed pair. */
  bypassId: string;
  phase: "started" | "completed";
  outcome?: "success" | "error";
  reason: string;
  actorId: string;
  auditMeta?: Record<string, unknown>;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  errorMessage?: string;
}

export type TenantScopeBypassSink = (event: TenantScopeBypassEvent) => void | Promise<void>;

const bypassStorage = new AsyncLocalStorage<TenantScopeBypassEvent | null>();

/** Always-on sink: structured warning so a bypass is never silent. */
const defaultSink: TenantScopeBypassSink = (event) => {
  if (event.phase === "started") {
    getDbLogger().warn(
      {
        audit: event,
        actorId: event.actorId,
        reason: event.reason,
        auditMeta: event.auditMeta,
      },
      "Tenant scope bypassed — platform-level database access without RLS tenant scope",
    );
  } else if (event.outcome === "error") {
    getDbLogger().error({ audit: event }, "Tenant scope bypass failed");
  }
};

let extraSinks: TenantScopeBypassSink[] = [];

/**
 * Register an additional audit sink (e.g. the backend's audit-trail writer).
 * Returns an unregister function (tests / worker teardown).
 */
export function registerTenantScopeBypassSink(sink: TenantScopeBypassSink): () => void {
  extraSinks = [...extraSinks, sink];
  return () => {
    extraSinks = extraSinks.filter((candidate) => candidate !== sink);
  };
}

/** Remove all registered sinks except the always-on structured log (tests only). */
export function resetTenantScopeBypassSinksForTesting(): void {
  extraSinks = [];
}

/** True while the current async call tree is inside a `bypassTenantScope()` block. */
export function inTenantScopeBypass(): boolean {
  return bypassStorage.getStore() != null;
}

/** The bypass event currently in scope, if any (forensics / nested guards). */
export function getTenantScopeBypassEvent(): TenantScopeBypassEvent | null {
  return bypassStorage.getStore() ?? null;
}

let sequence = 0;
function nextBypassId(): string {
  sequence += 1;
  return `tsb_${Date.now().toString(36)}_${sequence.toString(36)}`;
}

function assertNonEmpty(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(
      `bypassTenantScope requires a non-empty \`${field}\` — an unauditable platform bypass is not allowed.`,
    );
  }
  return value.trim();
}

async function emit(event: TenantScopeBypassEvent): Promise<void> {
  await defaultSink(event);
  for (const sink of extraSinks) {
    // Deliberately not caught: an audit sink failure aborts the bypass.
    await sink(event);
  }
}

/**
 * Run `fn` with tenant-scope enforcement explicitly bypassed, emitting an audit
 * event at invocation and at completion.
 *
 * - Nested bypasses are rejected (a second bypass masks the first audit record).
 * - Missing/blank `reason` or `actorId` throws before anything runs.
 */
export async function bypassTenantScope<T>(
  options: TenantScopeBypassOptions,
  fn: () => Promise<T> | T,
): Promise<T> {
  if (inTenantScopeBypass()) {
    throw new Error(
      "bypassTenantScope cannot be nested — an outer bypass is already active. " +
        "Reuse the existing scope or restructure the platform operation.",
    );
  }
  const reason = assertNonEmpty(options?.reason, "reason");
  const actorId = assertNonEmpty(options?.actorId, "actorId");

  const startedAt = new Date();
  const started: TenantScopeBypassEvent = {
    type: "tenant_scope.bypassed",
    bypassId: nextBypassId(),
    phase: "started",
    reason,
    actorId,
    auditMeta: options.auditMeta,
    startedAt: startedAt.toISOString(),
  };
  await emit(started);

  try {
    const result = await bypassStorage.run(started, async () => fn());
    await emit({
      ...started,
      phase: "completed",
      outcome: "success",
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
    });
    return result;
  } catch (error) {
    await emit({
      ...started,
      phase: "completed",
      outcome: "error",
      errorMessage: error instanceof Error ? error.message : String(error),
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
    });
    throw error;
  }
}
