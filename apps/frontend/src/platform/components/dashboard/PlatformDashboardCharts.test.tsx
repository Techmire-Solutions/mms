import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PlatformDashboardCharts } from "./PlatformDashboardCharts";

const trend = vi.hoisted(() => ({ data: [{ month: "Sep", tenants: 2, ops: 0 }] }));
vi.mock("@/platform/hooks/usePlatformTelemetry", () => ({
  usePlatformActivityTrend: () => trend,
}));
vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("platform dashboard chart cards", () => {
  it("labels both cards and retains the awaiting-trend message", () => {
    const html = renderToStaticMarkup(
      <PlatformDashboardCharts activeWorkspaces={2} disabledWorkspaces={1} />,
    );
    expect(html).toContain('aria-label="platform.charts.activeVsInactive"');
    expect(html).toContain('aria-label="platform.charts.activityTrend"');
    expect(html).toContain("platform.charts.awaitingTrend");
  });

  it("hides the awaiting-trend message once operations exist", () => {
    trend.data = [{ month: "Sep", tenants: 2, ops: 3 }];
    const html = renderToStaticMarkup(
      <PlatformDashboardCharts activeWorkspaces={2} disabledWorkspaces={1} />,
    );
    expect(html).not.toContain("platform.charts.awaitingTrend");
  });
});
