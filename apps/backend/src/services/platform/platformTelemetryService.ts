import { performance } from "node:perf_hooks";
import { getPoolMetrics, getTenantDbMetrics, pingDatabase } from "../../db/dbConnection.js";
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
    rlsIsolation: "enforced";
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

export async function getPlatformTelemetry(): Promise<PlatformTelemetryResult> {
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

  return {
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
      rlsIsolation: "enforced",
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
}

export async function getPlatformActivityTrend(
  monthsCount = 6,
): Promise<MonthlyPlatformActivityItem[]> {
  return getPlatformMonthlyActivityTrend(monthsCount);
}
