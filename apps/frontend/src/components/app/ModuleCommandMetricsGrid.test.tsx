import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Users } from "lucide-react";
import { ModuleCommandMetricsGrid, type MetricItem } from "./ModuleCommandMetricsGrid";

const item = (label: string): MetricItem => ({ label, value: 1, icon: Users });

describe("ModuleCommandMetricsGrid", () => {
  it("renders five metrics on one row at desktop widths", () => {
    // Regression guard for the 2026-10-31 review (UX-14): 5 items mapped to a
    // 4-column grid at 1440, leaving a lone card on the second row.
    const html = renderToStaticMarkup(
      <ModuleCommandMetricsGrid items={["A", "B", "C", "D", "E"].map(item)} />,
    );
    expect(html).toContain("lg:grid-cols-5");
    expect(html).toContain("grid-cols-2");
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
