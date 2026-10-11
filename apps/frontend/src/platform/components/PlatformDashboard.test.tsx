import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlatformDashboard } from "../components/PlatformDashboard";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => true,
}));

vi.mock("@/platform/hooks/usePlatformPermissions", () => ({
  usePlatformPermissions: () => ({
    platformUser: { id: "admin-1", name: "Zaid", email: "zaid@example.com" },
    isSuperUser: true,
    canWorkspaces: true,
    canOnboard: true,
    canSystem: true,
    canAdmins: true,
  }),
}));

vi.mock("@/platform/hooks/usePlatformWorkspaceMetrics", () => ({
  usePlatformWorkspaceMetrics: () => ({
    data: { total: 3, active: 2, inactive: 1 },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/platform/hooks/usePlatformTelemetry", () => ({
  usePlatformActivityTrend: () => ({
    data: [
      { month: "Jan", tenants: 1, ops: 2 },
      { month: "Feb", tenants: 2, ops: 4 },
    ],
  }),
}));

vi.mock("@/platform/components/dashboard/PlatformDashboardBanner", () => ({
  PlatformDashboardBanner: () => <div data-testid="dashboard-banner">banner</div>,
}));

vi.mock("@/platform/components/dashboard/PlatformDashboardCharts", () => ({
  PlatformDashboardCharts: () => <div data-testid="dashboard-charts">charts</div>,
}));

vi.mock("@/platform/components/dashboard/PlatformDashboardQuickActions", () => ({
  PlatformDashboardQuickActions: () => <div data-testid="dashboard-actions">actions</div>,
}));

vi.mock("@/platform/components/dashboard/PlatformDashboardTelemetry", () => ({
  PlatformDashboardTelemetry: () => <div data-testid="dashboard-health-summary">health</div>,
}));

vi.mock("@/platform/components/dashboard/PlatformDashboardFleet", () => ({
  PlatformDashboardFleet: () => <div data-testid="dashboard-fleet">fleet</div>,
}));

vi.mock("@/components/ui/ModuleCommandMetricsGrid", () => ({
  ModuleCommandMetricsGrid: () => <div data-testid="dashboard-metrics">metrics</div>,
}));

describe("PlatformDashboard section order", () => {
  it("places banner and metrics before fleet, charts, and health summary CTA", () => {
    const html = renderToStaticMarkup(<PlatformDashboard />);

    const banner = html.indexOf('data-testid="dashboard-banner"');
    const metrics = html.indexOf('data-testid="dashboard-metrics"');
    const fleet = html.indexOf('data-testid="dashboard-fleet"');
    const charts = html.indexOf('data-testid="dashboard-charts"');
    const health = html.indexOf('data-testid="dashboard-health-summary"');

    expect(banner).toBeGreaterThan(-1);
    expect(metrics).toBeGreaterThan(banner);
    expect(fleet).toBeGreaterThan(metrics);
    expect(charts).toBeGreaterThan(fleet);
    expect(health).toBeGreaterThan(charts);
  });
});
