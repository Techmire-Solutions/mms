import { performance } from "node:perf_hooks";
import { getPoolMetrics, getTenantDbMetrics, pingDatabase } from "@mms/db/client";
import {
  getPlatformMonthlyActivityTrend,
  type MonthlyPlatformActivityItem,
} from "../../db/repositories/platformActivityLogsRepository.js";

export interface PlatformTelemetryResult {
  platformDb: {
    engine: string;
    totalCount: number;
    idleCount: number;
    waitingCount: number;
    activeCount: number;
    utilizationRate: number;
    latencyMs: number;
    hasReplica: boolean;
  };
  tenantDb: {
    /** Static schema assertion (FORCE ROW LEVEL SECURITY), not a live per-table probe. */
    rlsIsolation: "schema-enforced";
    activeTenantsCount: number;
    totalTenantTransactions: number;
    tenantCapLimit: number;
    tenantBudgetPercent: number;
    activeTenants: { tenant: string; count: number }[];
  };
  dbPool: {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
    activeCount: number;
    utilizationRate: number;
  };
  memory: {
    rssMb: number;
    heapUsedMb: number;
    heapTotalMb: number;
    externalMb: number;
  };
  latencyMs: number;
  uptimeSeconds: number;
}

const TELEMETRY_CACHE_TTL_MS = 5_000;
let telemetryCache: { result: PlatformTelemetryResult; expiresAt: number } | null = null;

export async function getPlatformTelemetry(): Promise<PlatformTelemetryResult> {
  const nowMs = Date.now();
  // A short TTL collapses the frontend's 30s poll across concurrent operators
  // into one DB ping (2026-11-17 review, P9).
  if (telemetryCache && telemetryCache.expiresAt > nowMs) {
    return telemetryCache.result;
  }

  const mem = process.memoryUsage();
  const pool = getPoolMetrics() ?? { totalCount: 1, idleCount: 1, waitingCount: 0 };
  const tenantMetrics = getTenantDbMetrics();
  const total = pool.totalCount;
  const idle = pool.idleCount;
  const active = Math.max(0, total - idle);
  const utilizationRate = total > 0 ? Math.round((active / total) * 100) : 0;

  const start = performance.now();
  await pingDatabase();
  const latencyMs = Math.round(performance.now() - start);

  const result: PlatformTelemetryResult = {
    platformDb: {
      engine: "PostgreSQL 16 (Drizzle ORM)",
      totalCount: total,
      idleCount: idle,
      waitingCount: pool.waitingCount,
      activeCount: active,
      utilizationRate,
      latencyMs,
      hasReplica: Boolean(pool.replica),
    },
    tenantDb: {
      rlsIsolation: "schema-enforced",
      activeTenantsCount: tenantMetrics.activeTenantsCount,
      totalTenantTransactions: tenantMetrics.totalTenantActiveTransactions,
      tenantCapLimit: tenantMetrics.tenantCapLimit,
      tenantBudgetPercent: tenantMetrics.tenantBudgetPercent,
      activeTenants: tenantMetrics.activeTenants,
    },
    dbPool: {
      totalCount: total,
      idleCount: idle,
      waitingCount: pool.waitingCount,
      activeCount: active,
      utilizationRate,
    },
    memory: {
      rssMb: Math.round(mem.rss / (1024 * 1024)),
      heapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
      heapTotalMb: Math.round(mem.heapTotal / (1024 * 1024)),
      externalMb: Math.round(mem.external / (1024 * 1024)),
    },
    latencyMs,
    uptimeSeconds: Math.floor(process.uptime()),
  };
  telemetryCache = { result, expiresAt: nowMs + TELEMETRY_CACHE_TTL_MS };
  return result;
}

export async function getPlatformActivityTrend(
  monthsCount = 6,
): Promise<MonthlyPlatformActivityItem[]> {
  return getPlatformMonthlyActivityTrend(monthsCount);
}
