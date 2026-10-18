import { describe, it, expect, vi } from "vitest";
import { synthesizePlatformAiDiagnostics } from "../services/platform/platformAiService.js";

vi.mock("../services/platform/platformTelemetryService.js", () => ({
  getPlatformTelemetry: vi.fn().mockResolvedValue({
    platformDb: {
      engine: "PostgreSQL 16 (Drizzle ORM)",
      totalCount: 10,
      idleCount: 8,
      waitingCount: 0,
      activeCount: 2,
      utilizationRate: 20,
      latencyMs: 4,
      hasReplica: false,
    },
    tenantDb: {
      rlsIsolation: "enforced",
      activeTenantsCount: 15,
      totalTenantTransactions: 120,
      tenantCapLimit: 100,
      tenantBudgetPercent: 15,
      activeTenants: [{ tenant: "demo", count: 12 }],
    },
    dbPool: {
      totalCount: 10,
      idleCount: 8,
      waitingCount: 0,
      activeCount: 2,
      utilizationRate: 20,
    },
    memory: {
      rssMb: 120,
      heapUsedMb: 65,
      heapTotalMb: 90,
      externalMb: 10,
    },
    latencyMs: 4,
    uptimeSeconds: 3600,
  }),
}));

describe("platformAiService", () => {
  it("synthesizes queue diagnostics for background worker queries", async () => {
    const result = await synthesizePlatformAiDiagnostics({
      prompt: "Explain BullMQ queue status and worker loops",
      context: { currentRoute: "/platform/system" },
    });

    expect(result.success).toBe(true);
    expect(result.analysis).toContain("BullMQ queue telemetry");
    expect(result.analysis).toContain("120");
    expect(result.suggestions.some((s) => s.target === "/platform/system")).toBe(true);
  });

  it("synthesizes database diagnostics for pool queries", async () => {
    const result = await synthesizePlatformAiDiagnostics({
      prompt: "Are there any slow queries or database pool issues?",
      context: { currentRoute: "/platform/system" },
    });

    expect(result.success).toBe(true);
    expect(result.analysis).toContain("Database connection pool utilization is at 20%");
    expect(result.analysis).toContain("4ms");
    expect(result.suggestions.some((s) => s.actionType === "refresh")).toBe(true);
  });

  it("synthesizes workspace recommendations for tenant queries", async () => {
    const result = await synthesizePlatformAiDiagnostics({
      prompt: "Summarize inactive workspaces and tenant count",
      context: { currentRoute: "/platform/workspaces" },
    });

    expect(result.success).toBe(true);
    expect(result.analysis).toContain("Platform manages 15 active madrasa tenants");
    expect(result.suggestions.some((s) => s.actionType === "filter")).toBe(true);
  });
});
