import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StatCardSparkline } from "./StatCardSparkline";

describe("StatCardSparkline Component", () => {
  it("returns null when data is empty or has fewer than 2 points", () => {
    const emptyHtml = renderToStaticMarkup(<StatCardSparkline data={[]} />);
    expect(emptyHtml).toBe("");

    const singlePointHtml = renderToStaticMarkup(<StatCardSparkline data={[10]} />);
    expect(singlePointHtml).toBe("");
  });

  it("renders container with aria-hidden when valid data points are provided", () => {
    const html = renderToStaticMarkup(<StatCardSparkline data={[10, 25, 18, 30]} />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("w-16 h-8");
  });
});
