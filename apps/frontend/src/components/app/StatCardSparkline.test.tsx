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

  it("renders an inert container so the decorative chart is not focusable", () => {
    const html = renderToStaticMarkup(<StatCardSparkline data={[10, 25, 18, 30]} />);
    expect(html).toContain("inert");
    expect(html).not.toContain('aria-hidden="true"');
    expect(html).toContain("w-16 h-8");
  });
});
