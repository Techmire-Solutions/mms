import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StatCardTrend, formatTrendDelta } from "./StatCardTrend";

describe("formatTrendDelta", () => {
  it("formats a percentage-point delta with pp, not %", () => {
    expect(formatTrendDelta(5, "points")).toBe("5 pp");
    expect(formatTrendDelta(-3, "points")).toBe("3 pp");
  });

  it("formats a relative change with %", () => {
    expect(formatTrendDelta(15)).toBe("15%");
  });
});

describe("StatCardTrend Component", () => {
  it("renders positive trend percentage and upward indicator", () => {
    const html = renderToStaticMarkup(<StatCardTrend trend={15} />);
    expect(html).toContain("15%");
  });

  it("renders negative trend percentage", () => {
    const html = renderToStaticMarkup(<StatCardTrend trend={-8} />);
    expect(html).toContain("8%");
  });

  it("renders trendLabel when provided", () => {
    const html = renderToStaticMarkup(<StatCardTrend trend={12} trendLabel="vs last month" />);
    expect(html).toContain("12%");
    expect(html).toContain("vs last month");
  });

  it("caps absurd deltas instead of blowing out the card", () => {
    // Regression guard for the 2026-10-31 review (UX-18): a prior-period jump
    // rendered as `42467%` and overflowed the KPI.
    expect(renderToStaticMarkup(<StatCardTrend trend={42467} />)).toContain("999%+");
    expect(renderToStaticMarkup(<StatCardTrend trend={-1200} />)).toContain("999%+");
    expect(renderToStaticMarkup(<StatCardTrend trend={999} />)).toContain("999%");
    expect(renderToStaticMarkup(<StatCardTrend trend={Number.POSITIVE_INFINITY} />)).toContain(
      "0%",
    );
  });
});
