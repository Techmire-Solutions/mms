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

  it("given a wide header action such as a legend, should let it wrap below the title instead of overflowing the card", () => {
    // Arrange
    const html = renderToStaticMarkup(
      <ReportChartCard title="Status Distribution" action={<span>Present 0 Absent 0 Late 0</span>}>
        <div>Chart</div>
      </ReportChartCard>,
    );

    // Act
    const card = new DOMParser().parseFromString(html, "text/html").body.firstElementChild;
    const headerRow = card?.querySelector("h3")?.parentElement?.parentElement;
    const actionSlot = headerRow?.lastElementChild;

    // Assert
    expect(headerRow?.classList.contains("flex-wrap")).toBe(true);
    expect(actionSlot?.textContent).toBe("Present 0 Absent 0 Late 0");
    expect(actionSlot?.classList.contains("shrink-0")).toBe(false);
    expect(actionSlot?.classList.contains("max-w-full")).toBe(true);
  });
});
