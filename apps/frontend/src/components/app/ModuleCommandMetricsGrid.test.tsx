import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Users } from "lucide-react";
import { ModuleCommandMetricsGrid, type MetricItem } from "./ModuleCommandMetricsGrid";

const item = (label: string): MetricItem => ({ label, value: 1, icon: Users });

describe("ModuleCommandMetricsGrid", () => {
  it("keeps five metrics on one row only from xl, with readable cards at lg", () => {
    // 2026-11-04 review (UX-02): at 1024 a 5-column strip left 48px per label, so
    // every KPI label was ellipsized. Five-across now starts at xl; lg uses three.
    const html = renderToStaticMarkup(
      <ModuleCommandMetricsGrid items={["A", "B", "C", "D", "E"].map(item)} />,
    );
    expect(html).toContain("grid-cols-2");
    expect(html).toContain("sm:grid-cols-3");
    expect(html).toContain("lg:grid-cols-3");
    expect(html).toContain("xl:grid-cols-5");
    expect(html).not.toContain("lg:grid-cols-5");
    // A 5-item strip leaves an orphan at 375 unless the last card spans both columns.
    expect(html).toContain("col-span-2 sm:col-span-1");
  });

  it("gives six metrics two rows below xl and one row from 2xl", () => {
    const html = renderToStaticMarkup(
      <ModuleCommandMetricsGrid items={["A", "B", "C", "D", "E", "F"].map(item)} />,
    );
    expect(html).toContain("grid-cols-2");
    expect(html).toContain("sm:grid-cols-3");
    expect(html).toContain("xl:grid-cols-4");
    expect(html).toContain("2xl:grid-cols-6");
    expect(html).not.toContain("sm:col-span-1");
  });

  it("uses two columns on mobile so the directory stays above the fold", () => {
    // 2026-10-31 review (UX-17): mobile command metrics stacked 1-up.
    const html = renderToStaticMarkup(
      <ModuleCommandMetricsGrid items={["A", "B", "C", "D"].map(item)} />,
    );
    expect(html).toContain("grid-cols-2");
    expect(html).toContain("lg:grid-cols-4");
  });

  it("keeps a single metric full width", () => {
    const html = renderToStaticMarkup(<ModuleCommandMetricsGrid items={[item("A")]} />);
    expect(html).toContain("grid-cols-1");
  });
});
