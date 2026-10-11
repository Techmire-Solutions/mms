import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlatformDatabaseTelemetryCard } from "./PlatformDatabaseTelemetryCard";
import type { PlatformTelemetryData } from "@/platform/hooks/usePlatformTelemetry";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("PlatformDatabaseTelemetryCard", () => {
  const mockTelemetry: PlatformTelemetryData = {
    platformDb: {
      engine: "PostgreSQL 16 (Drizzle ORM)",
      totalCount: 30,
      idleCount: 22,
      waitingCount: 0,
      activeCount: 8,
      utilizationRate: 27,
      latencyMs: 14,
      hasReplica: false,
    },
    tenantDb: {
      rlsIsolation: "enforced",
      activeTenantsCount: 3,
      totalTenantTransactions: 5,
      tenantCapLimit: 12,
      tenantBudgetPercent: 40,
      activeTenants: [
        { tenant: "tenant-alpha", count: 3 },
        { tenant: "tenant-beta", count: 2 },
      ],
    },
    dbPool: {
      totalCount: 30,
      idleCount: 22,
      waitingCount: 0,
      activeCount: 8,
      utilizationRate: 27,
    },
    memory: {
      rssMb: 240,
      heapUsedMb: 95,
      heapTotalMb: 140,
      externalMb: 12,
    },
    latencyMs: 14,
    uptimeSeconds: 3600,
  };

  it("renders separated platform DB metrics correctly", () => {
    const html = renderToStaticMarkup(<PlatformDatabaseTelemetryCard telemetry={mockTelemetry} />);

    expect(html).toContain("platform.db.platformTitle");
    expect(html).toContain("PostgreSQL 16 (Drizzle ORM)");
    expect(html).toContain("Primary Node");
    expect(html).toContain("27%");
    expect(html).toContain("8/30");
    expect(html).toContain("14ms");
  });

  it("renders separated tenant DB metrics and active tenants breakdown", () => {
    const html = renderToStaticMarkup(<PlatformDatabaseTelemetryCard telemetry={mockTelemetry} />);

    expect(html).toContain("platform.db.tenantTitle");
    expect(html).toContain("RLS 100% Enforced");
    expect(html).toContain("12 conns");
    expect(html).toContain("40% pool ceiling");
    expect(html).toContain("tenant-alpha");
    expect(html).toContain("3 tx");
    expect(html).toContain("tenant-beta");
    expect(html).toContain("2 tx");
  });

  it("renders empty tenant transactions state when no tenants have active tx", () => {
    const emptyTenantTelemetry: PlatformTelemetryData = {
      ...mockTelemetry,
      tenantDb: {
        ...mockTelemetry.tenantDb!,
        activeTenantsCount: 0,
        totalTenantTransactions: 0,
        activeTenants: [],
      },
    };

    const html = renderToStaticMarkup(
      <PlatformDatabaseTelemetryCard telemetry={emptyTenantTelemetry} />,
    );

    expect(html).toContain("platform.db.noActiveTenantTx");
  });

  it("renders near cap warning when a tenant approaches connection limit", () => {
    const nearCapTelemetry: PlatformTelemetryData = {
      ...mockTelemetry,
      tenantDb: {
        ...mockTelemetry.tenantDb!,
        tenantCapLimit: 5,
        activeTenants: [{ tenant: "tenant-busy", count: 4 }],
      },
    };

    const html = renderToStaticMarkup(
      <PlatformDatabaseTelemetryCard telemetry={nearCapTelemetry} />,
    );

    expect(html).toContain("Near Cap Warning");
    expect(html).toContain("near 5");
  });
});
