import { sql } from "drizzle-orm";
import {
  activeDb,
  getReadReplicaDb,
  hasActiveTransaction,
  withActiveTransaction,
} from "./dbConnection.js";
import type { DbClient } from "./dbConnection.js";

import { tracer } from "../config/telemetry.js";
import { applyTenantTransactionGuards } from "./tenantTransactionGuards.js";
import { logger } from "../lib/logger.js";

export type TenantTransaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
export type AppDb = TenantTransaction;

export interface WithTenantOptions {
  readOnly?: boolean;
  statementTimeoutMs?: number;
  /**
   * Explicit opt-in for genuine platform/global work — platform-admin routes,
   * migrations, the worker, seeding.
   *
   * A falsy `tenantId` sets `app.rls_bypass = 'on'` for the transaction
   * (tenantTransactionGuards.ts), which makes every tenant RLS policy match
   * ALL rows. Requiring this flag keeps that escape hatch deliberate: without
   * it, a caller binding an unset request property would silently run with
   * tenant isolation disabled instead of failing closed.
   */
  allowGlobal?: boolean;
}

/**
 * Tenant is known to be present — no global opt-in needed.
 *
 * The overloads below are what make the fail-closed behaviour enforceable at
 * COMPILE time rather than only at runtime. Without them, a call site whose
 * tenant is `string | null | undefined` type-checks happily and then throws the
 * first time it runs outside a request context (migrations, seeding, worker
 * boot) — which is exactly how the document-store paths broke when this guard
 * was introduced.
 */
export function withTenant<T>(
  tenantId: string,
  callback: (tx: TenantTransaction) => Promise<T>,
  options?: WithTenantOptions,
): Promise<T>;
/**
 * Tenant MAY be absent — the caller must pass an explicit `allowGlobal`, so
 * RLS-bypassing access is always a visible decision at the call site.
 */
export function withTenant<T>(
  tenantId: string | null | undefined,
  callback: (tx: TenantTransaction) => Promise<T>,
  options: WithTenantOptions & { allowGlobal: boolean },
): Promise<T>;
export async function withTenant<T>(
  tenantId: string | null | undefined,
  callback: (tx: TenantTransaction) => Promise<T>,
  options: WithTenantOptions = {},
): Promise<T> {
  const resolvedTenantId = tenantId || "";

  // Defensive guard: a tenant id of the literal strings "undefined"/"null"
  // indicates a caller binding an unset request property instead of a real
  // workspace subdomain. Fail loudly rather than running RLS against a
  // non-existent tenant.
  if (resolvedTenantId === "undefined" || resolvedTenantId === "null") {
    throw new Error(
      `withTenant received the literal string "${resolvedTenantId}" as tenant id — a caller is binding an unset request property. Check that authentication middleware decorates request.tenant.`,
    );
  }

  // Fail closed: an empty tenant would disable row-level security for this
  // transaction, so it must be requested explicitly.
  if (!resolvedTenantId && options.allowGlobal !== true) {
    throw new Error(
      "[withTenant] empty tenant id — refusing to run with RLS bypassed. " +
        "Pass a real workspace subdomain, or { allowGlobal: true } for intentional platform/global work.",
    );
  }

  if (typeof hasActiveTransaction === "function" && hasActiveTransaction()) {
    const active = activeDb();
    // Capture the outer transaction's RLS context first: `SET LOCAL` persists
    // until the transaction ends, so without restoring it, queries the outer
    // callback runs *after* this nested block would execute under the nested
    // tenant (a cross-tenant read/write window).
    const previousResult = await (
      active as unknown as {
        execute: (query: unknown) => Promise<{ rows?: Array<Record<string, unknown>> }>;
      }
    ).execute(
      sql`SELECT
        current_setting('app.current_tenant', true) AS tenant,
        current_setting('app.rls_bypass', true) AS bypass`,
    );
    const previous = previousResult?.rows?.[0];

    // Re-apply tenant RLS guards so a nested `withTenant` runs under its own
    // requested tenant rather than silently inheriting the outer transaction's
    // context. Idempotent when the tenant matches; correct when it differs.
    await applyTenantTransactionGuards(active as unknown as AppDb, resolvedTenantId, {
      statementTimeoutMs: options.statementTimeoutMs,
    });
    try {
      return await callback(active as unknown as TenantTransaction);
    } finally {
      try {
        const previousBypass = previous?.bypass;
        const previousTenant = previous?.tenant;
        if (previousBypass === "on") {
          // Outer scope was global (RLS bypassed) — restore that.
          await applyTenantTransactionGuards(active as unknown as AppDb, "");
        } else if (typeof previousTenant === "string" && previousTenant) {
          await applyTenantTransactionGuards(active as unknown as AppDb, previousTenant);
        }
      } catch {
        // If the transaction was aborted due to an error in `callback`,
        // restoring guards will fail with 25P02. Suppress so the real error propagates.
      }
    }
  }

  let pool: DbClient | undefined;
  let poolError: unknown;
  try {
    pool = options.readOnly ? getReadReplicaDb() : activeDb();
  } catch (err) {
    poolError = err;
    if (options.readOnly) {
      try {
        pool = activeDb();
        if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
          logger.warn("Read replica unavailable — executing this transaction on the primary");
        }
      } catch {
        // handled by the degradation branch below
      }
    }
  }
  if (!pool) {
    // Fail closed in production: running tenant work without a transaction/RLS
    // boundary is a correctness and isolation hazard. Tests mock use cases but
    // not the DB connection layer, so keep a no-op boundary there.
    if (process.env.NODE_ENV === "test" || process.env.VITEST) {
      return callback({} as TenantTransaction);
    }
    throw new Error(
      "[withTenant] no database client available — cannot run tenant work without a transaction boundary.",
      { cause: poolError },
    );
  }

  if (typeof pool.transaction !== "function") {
    if (process.env.NODE_ENV === "test" || process.env.VITEST) {
      return callback({} as TenantTransaction);
    }
    throw new Error(
      "[withTenant] active database client does not support transactions — cannot run tenant work without a transaction boundary.",
    );
  }

  return tracer.withSpan(
    "drizzle.transaction",
    {
      "db.system": "postgresql",
      "tenant.id": resolvedTenantId || "platform",
      "db.read_only": options.readOnly ?? false,
    },
    async () => {
      return pool.transaction(
        async (tx) => {
          // Single source of truth for tenant RLS GUCs + statement/idle budgets.
          await applyTenantTransactionGuards(tx as unknown as AppDb, resolvedTenantId, {
            statementTimeoutMs: options.statementTimeoutMs,
          });

          // Register this transaction as the active one for the callback's async
          // scope so nested runInTransaction()/activeDb() consumers join it rather
          // than opening a second pool client and a second transaction.
          return withActiveTransaction(tx as unknown as DbClient, () =>
            callback(tx as unknown as TenantTransaction),
          );
        },
        options.readOnly ? { accessMode: "read only" } : undefined,
      );
    },
  );
}

/**
 * Ergonomic read-only wrapper around `withTenant`.
 * Automatically routes queries to the read replica pool and configures explicit
 * PostgreSQL `read only` transaction access mode.
 */
export function withTenantRead<T>(
  tenantId: string,
  callback: (tx: TenantTransaction) => Promise<T>,
  options?: { statementTimeoutMs?: number },
): Promise<T>;
export function withTenantRead<T>(
  tenantId: string | null | undefined,
  callback: (tx: TenantTransaction) => Promise<T>,
  options: { statementTimeoutMs?: number; allowGlobal: boolean },
): Promise<T>;
export async function withTenantRead<T>(
  tenantId: string | null | undefined,
  callback: (tx: TenantTransaction) => Promise<T>,
  options: { statementTimeoutMs?: number; allowGlobal?: boolean } = {},
): Promise<T> {
  // Mirrors `withTenant`'s overloads, so a nullable tenant here also requires an
  // explicit `allowGlobal` rather than failing at runtime.
  return withTenant(tenantId as string, callback, {
    ...options,
    readOnly: true,
  } as WithTenantOptions);
}

/**
 * Runs work with tenant isolation intentionally disabled, across every
 * workspace.
 *
 * This is the explicit, greppable form of `withTenant(null, …, { allowGlobal:
 * true })`. Legitimate callers: platform-admin routes, schema/data migrations,
 * the background worker boot, seeding, and whole-database backup/restore.
 *
 * NEVER call this from a tenant-scoped request path — it makes every tenant RLS
 * policy match all rows.
 */
export async function withGlobalTenant<T>(
  callback: (tx: TenantTransaction) => Promise<T>,
  options: { statementTimeoutMs?: number } = {},
): Promise<T> {
  return withTenant(null, callback, { ...options, allowGlobal: true });
}
