import type pg from "pg";
import { ServiceUnavailableError } from "../lib/httpErrors.js";

export type DatabasePoolRole = "http" | "worker";

export interface PoolMetrics {
  role?: DatabasePoolRole;
  totalCount: number;
  idleCount: number;
  waitingCount: number;
  replica?: {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  };
}

export interface TenantDbMetrics {
  activeTenantsCount: number;
  totalTenantActiveTransactions: number;
  tenantCapLimit: number;
  tenantBudgetPercent: number;
  activeTenants: { tenant: string; count: number }[];
}

const tenantTxCounts = new Map<string, number>();

export function incrementTenantTx(tenant: string): void {
  tenantTxCounts.set(tenant, (tenantTxCounts.get(tenant) || 0) + 1);
}

export function decrementTenantTx(tenant: string): void {
  const count = tenantTxCounts.get(tenant) || 0;
  if (count <= 1) {
    tenantTxCounts.delete(tenant);
  } else {
    tenantTxCounts.set(tenant, count - 1);
  }
}

export function checkTenantConnectionBudget(
  tenant: string,
  activePoolRole: DatabasePoolRole,
  activeMaxPoolSize: number,
): void {
  if (activePoolRole === "http") {
    const active = tenantTxCounts.get(tenant) || 0;
    // Cap any single tenant at 40% of the HTTP pool (min 5 connections)
    const limit = Math.max(5, Math.floor(activeMaxPoolSize * 0.4));
    if (active >= limit) {
      throw new ServiceUnavailableError(
        `Too many concurrent database requests for workspace. Please try again shortly.`,
      );
    }
  }
}

/** Returns connection count telemetry for database health checks. */
export function buildPoolMetrics(
  pool: pg.Pool | null,
  readReplicaPool: pg.Pool | null,
  activePoolRole: DatabasePoolRole,
): PoolMetrics | null {
  if (!pool) return null;
  const metrics: PoolMetrics = {
    role: activePoolRole,
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
  if (readReplicaPool && readReplicaPool !== pool) {
    metrics.replica = {
      totalCount: readReplicaPool.totalCount,
      idleCount: readReplicaPool.idleCount,
      waitingCount: readReplicaPool.waitingCount,
    };
  }
  return metrics;
}

/** Returns live per-tenant active transaction metrics and connection budget. */
export function buildTenantDbMetrics(activeMaxPoolSize: number): TenantDbMetrics {
  const activeTenants = Array.from(tenantTxCounts.entries())
    .filter(([_, count]) => count > 0)
    .map(([tenant, count]) => ({ tenant, count }));
  const totalTenantActiveTransactions = activeTenants.reduce((sum, item) => sum + item.count, 0);
  const tenantCapLimit = Math.max(5, Math.floor(activeMaxPoolSize * 0.4));
  return {
    activeTenantsCount: activeTenants.length,
    totalTenantActiveTransactions,
    tenantCapLimit,
    tenantBudgetPercent: 40,
    activeTenants,
  };
}
