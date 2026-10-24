import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlatformReports } from "./PlatformReports";

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
    platformUser: {
      id: "p-1",
      name: "Super Admin",
      email: "super@platform.local",
      role: "super_user",
      permissions: { workspaces: true, onboard: true, settings: true, admins: true, system: true },
    },
    isSuperUser: true,
    canWorkspaces: true,
    canOnboard: true,
    canSettings: true,
    canAdmins: true,
    canSystem: true,
  }),
}));

vi.mock("@/platform/hooks/usePlatformWorkspaces", () => ({
  usePlatformWorkspaces: () => ({
    data: [
      {
        subdomain: "demo",
        madrasaName: "Demo Madrasa",
        enabled: true,
        requireEmailVerification: true,
        adminEmail: "admin@demo.local",
        createdAt: "2026-01-01T00:00:00Z",
      },
    ],
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("./reports/PlatformReportsGrowthChart", () => ({
  PlatformReportsGrowthChart: () => <div data-testid="growth-chart" />,
}));

vi.mock("./reports/PlatformReportsPieCharts", () => ({
  PlatformReportsPieCharts: () => <div data-testid="pie-charts" />,
}));

describe("PlatformReports", () => {
  it("renders reports header, export actions, and analytics content", () => {
    const html = renderToStaticMarkup(<PlatformReports />);

    expect(html).toContain("module.reports");
    expect(html).toContain("platform.reports.growthTrendSub");
    expect(html).toContain("platform.reports.exportCsv");
  });
});
