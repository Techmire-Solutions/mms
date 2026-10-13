import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ReportChartCard } from "./ReportChartCard";

vi.mock("@/components/app/SafeResponsiveContainer", () => ({
  SafeResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}));

describe("ReportChartCard Component", () => {
  it("renders title, subtitle, and children content", () => {
    const html = renderToStaticMarkup(
      <ReportChartCard
        title="Test Chart Title"
        subtitle="Test Chart Subtitle"
        accentColor="primary"
      >
        <div data-testid="child-chart">Chart Content</div>
      </ReportChartCard>,
    );

    expect(html).toContain("Test Chart Title");
    expect(html).toContain("Test Chart Subtitle");
    expect(html).toContain("Chart Content");
  });

  it("renders actions slot when provided", () => {
    const html = renderToStaticMarkup(
      <ReportChartCard title="Title with Actions" actions={<button type="button">Export</button>}>
        <div>Content</div>
      </ReportChartCard>,
    );

    expect(html).toContain("Export");
  });
});
