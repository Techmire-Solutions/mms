import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StatCardTrend } from "./StatCardTrend";

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
});
