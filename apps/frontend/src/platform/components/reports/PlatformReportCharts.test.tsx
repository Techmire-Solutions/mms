import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PlatformReportsGrowthChart } from "./PlatformReportsGrowthChart";
import { PlatformReportsPieCharts } from "./PlatformReportsPieCharts";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("platform report chart cards", () => {
  it("keeps the timeframe controls and empty state in the shared growth card", () => {
    const html = renderToStaticMarkup(<PlatformReportsGrowthChart workspaces={[]} />);
    expect(html).toContain('aria-label="platform.reports.growthTrend"');
    expect(html).toContain("platform.reports.timeframe30d");
    expect(html).toContain("apex.noMadrasasYet");
  });

  it("renders independently labeled distribution cards with empty states", () => {
    const html = renderToStaticMarkup(
      <PlatformReportsPieCharts
        totalWorkspaces={0}
        activeWorkspaces={0}
        disabledWorkspaces={0}
        verifyRequiredCount={0}
        verifyOptionalCount={0}
      />,
    );
    expect(html).toContain('aria-label="platform.workspaceDistribution"');
    expect(html).toContain('aria-label="platform.reports.emailVerificationBreakdown"');
    expect(html.match(/apex.noMadrasasYet/g)).toHaveLength(2);
  });
});
