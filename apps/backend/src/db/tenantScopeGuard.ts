import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Single runtime guard for "real tenant, or an explicit global opt-in".
 *
 * Every transaction helper on the backend ends up in
 * `applyTenantTransactionGuards`, where a falsy tenant sets
 * `app.rls_bypass = 'on'` — making every tenant RLS policy match ALL rows. That
 * must never happen implicitly: a caller that binds an unset request property
 * has to fail loudly instead of silently running without row-level security.
 *
 * `withTenant` enforced this privately; `runInTransaction` and
 * `beginLongLivedTenantTransaction` did not, so a background or streaming path
 * that lost its AsyncLocalStorage context silently gained cross-tenant access.
 * All three now share this guard so the messages, the escape hatch, and the
 * tests stay identical.
 */
/**
 * Ambient "this whole call tree is intentional platform/global work" scope.
 *
 * Needed for boot-time code that must keep working unchanged: the TypeScript
 * data migrations under `db/migrations/` are already applied on deployed
 * databases (forward-only — they cannot be edited to pass `allowGlobal`), yet
 * they call `runInTransaction` with no request context. dbInit wraps each one in
 * this scope instead, so the fail-closed guard stays intact everywhere else.
 */
const globalScopeStorage = new AsyncLocalStorage<boolean>();

export function runWithGlobalTenantScope<T>(fn: () => T): T {
  return globalScopeStorage.run(true, fn);
}

export function inGlobalTenantScope(): boolean {
  return globalScopeStorage.getStore() === true;
}

export interface TenantScopeOptions {
  /**
   * Explicit opt-in for genuine platform/global work (platform-admin routes,
   * migrations, the worker boot, seeding, whole-database backup/restore).
   * When the tenant is present anyway, `allowGlobal` changes nothing — the
   * transaction is still scoped to that tenant.
   */
  allowGlobal?: boolean;
}

/**
 * Returns the tenant to run with, or throws when it is missing and global
 * access was not requested explicitly.
 *
 * @param tenantId Raw tenant id (workspace subdomain) or a falsy value.
 * @param options `allowGlobal: true` permits the empty case.
 * @param caller Helper name, used in the thrown message so the stack points at
 *   the boundary the developer called rather than at this shared file.
 */
export function resolveTenantScope(
  tenantId: string | null | undefined,
  options: TenantScopeOptions | undefined,
  caller: string,
): string {
  const resolvedTenantId = String(tenantId ?? "").trim();

  // Defensive guard: a tenant id of the literal strings "undefined"/"null"
  // indicates a caller binding an unset request property instead of a real
  // workspace subdomain. Fail loudly rather than running RLS against a
  // non-existent tenant.
  if (resolvedTenantId === "undefined" || resolvedTenantId === "null") {
    throw new Error(
      `[${caller}] received the literal string "${resolvedTenantId}" as tenant id — a caller is binding an unset request property. Check that authentication middleware decorates request.tenant.`,
    );
  }

  // Fail closed: an empty tenant would disable row-level security for this
  // transaction, so it must be requested explicitly (per call, or via the
  // boot-time ambient scope used by already-applied data migrations).
  if (!resolvedTenantId && options?.allowGlobal !== true && !inGlobalTenantScope()) {
    throw new Error(
      `[${caller}] empty tenant id — refusing to run with RLS bypassed. ` +
        "Pass a real workspace subdomain, or { allowGlobal: true } for intentional platform/global work.",
    );
  }

  return resolvedTenantId;
}
