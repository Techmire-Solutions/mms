import { describe, expect, it } from "vitest";
import { CHART_TEXT_MIN_PX, chartAxisTick, chartTooltipStyle } from "./ChartGrid";

describe("chartAxisTick", () => {
  it("clamps every requested size to the 12px typography floor", () => {
    // Recharts call sites used to pass 9/10/11, bypassing the token scale
    // (2026-10-31 review, UX-10).
    expect(CHART_TEXT_MIN_PX).toBe(12);
    expect(chartAxisTick().fontSize).toBe(12);
    expect(chartAxisTick(9).fontSize).toBe(12);
    expect(chartAxisTick(11).fontSize).toBe(12);
    expect(chartAxisTick(14).fontSize).toBe(14);
  });

  it("keeps the muted fill dialect for dashboard widgets", () => {
    expect(chartAxisTick(9, true)).toEqual({
      fontSize: 12,
      fill: "hsl(var(--muted-foreground))",
    });
    expect(chartAxisTick(13, false)).toEqual({ fontSize: 13 });
  });
});

describe("chartTooltipStyle", () => {
  it("consumes centralized theme tokens for card background, border, and radius", () => {
    const style = chartTooltipStyle();
    expect(style.backgroundColor).toBe("hsl(var(--card))");
    expect(style.borderColor).toBe("hsl(var(--border))");
    expect(style.borderRadius).toBe("var(--radius)");
    expect(style.color).toBe("hsl(var(--card-foreground))");
    expect(style.fontSize).toBe("12px");
  });

  it("allows custom overrides while preserving defaults", () => {
    const style = chartTooltipStyle({ padding: "8px", fontSize: "14px" });
    expect(style.padding).toBe("8px");
    expect(style.fontSize).toBe("14px");
    expect(style.borderRadius).toBe("var(--radius)");
  });
});
