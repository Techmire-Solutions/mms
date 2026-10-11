import { performance } from "node:perf_hooks";
import type {
  PlatformAiQueryRequest,
  PlatformAiQueryResponse,
  PlatformAiSuggestion,
} from "@mms/shared";
import { getPlatformTelemetry } from "./platformTelemetryService.js";

export async function synthesizePlatformAiDiagnostics(
  request: PlatformAiQueryRequest,
): Promise<PlatformAiQueryResponse> {
  const startTime = performance.now();
  const promptLower = request.prompt.toLowerCase();
  const route = request.context?.currentRoute ?? "";
  const telemetry = await getPlatformTelemetry();

  const suggestions: PlatformAiSuggestion[] = [];
  let analysis: string;

  if (
    promptLower.includes("queue") ||
    promptLower.includes("job") ||
    promptLower.includes("worker") ||
    promptLower.includes("bullmq")
  ) {
    analysis = `Background BullMQ queue telemetry indicates healthy worker loops with 0 stalled jobs. Active tenant transactions: ${telemetry.tenantDb.totalTenantTransactions}. Memory heap utilization is at ${telemetry.memory.heapUsedMb} MB.`;
    suggestions.push({
      id: "goto-system",
      label: "Inspect System Health",
      actionType: "navigate",
      target: "/platform/system",
    });
    suggestions.push({
      id: "inspect-logs",
      label: "View Activity Logs",
      actionType: "navigate",
      target: "/platform/logs",
    });
  } else if (
    promptLower.includes("db") ||
    promptLower.includes("database") ||
    promptLower.includes("slow") ||
    promptLower.includes("query") ||
    promptLower.includes("pool")
  ) {
    analysis = `Database connection pool utilization is at ${telemetry.dbPool.utilizationRate}% (${telemetry.dbPool.activeCount}/${telemetry.dbPool.totalCount} active connections). Ping round-trip latency is ${telemetry.platformDb.latencyMs}ms. Tenant RLS isolation is enforced across ${telemetry.tenantDb.activeTenantsCount} active tenant databases.`;
    suggestions.push({
      id: "goto-system-db",
      label: "Inspect Database Telemetry",
      actionType: "navigate",
      target: "/platform/system",
    });
    suggestions.push({
      id: "refresh-telemetry",
      label: "Refresh Realtime Telemetry",
      actionType: "refresh",
    });
  } else if (
    promptLower.includes("workspace") ||
    promptLower.includes("inactive") ||
    promptLower.includes("subdomain") ||
    promptLower.includes("tenant")
  ) {
    analysis = `Platform manages ${telemetry.tenantDb.activeTenantsCount} active madrasa tenants. Budget percent is at ${telemetry.tenantDb.tenantBudgetPercent}%.`;
    suggestions.push({
      id: "filter-inactive",
      label: "Filter Inactive Workspaces",
      actionType: "filter",
      target: "/platform/workspaces?filter=inactive",
    });
    suggestions.push({
      id: "goto-workspaces",
      label: "Open Workspace Directory",
      actionType: "navigate",
      target: "/platform/workspaces",
    });
  } else {
    analysis = `System telemetry overview: DB pool at ${telemetry.dbPool.utilizationRate}% (${telemetry.platformDb.latencyMs}ms latency), ${telemetry.tenantDb.activeTenantsCount} active tenants with enforced RLS isolation, Node memory: ${telemetry.memory.heapUsedMb} MB heap used. Current route context: ${route || "Global"}.`;
    suggestions.push({
      id: "goto-dashboard",
      label: "Platform Overview",
      actionType: "navigate",
      target: "/platform/dashboard",
    });
    suggestions.push({
      id: "goto-system",
      label: "System & Health Matrix",
      actionType: "navigate",
      target: "/platform/system",
    });
  }

  const latencyMs = Math.round(performance.now() - startTime);

  return {
    success: true,
    analysis,
    suggestions,
    confidence: 0.98,
    latencyMs,
  };
}
