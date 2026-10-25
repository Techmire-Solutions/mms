import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SessionCapacityPill } from "./SessionCapacityPill";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.percent != null) return `${params.percent}% capacity used`;
      return key;
    },
  }),
}));

describe("SessionCapacityPill Component", () => {
  it("renders success dot class when capacity usage is <= 80%", () => {
    const html = renderToStaticMarkup(
      <SessionCapacityPill totalEnrolled={15} totalCapacity={20} />,
    );
    expect(html).toContain("15/20");
    expect(html).toContain("75%");
    expect(html).toContain("bg-success");
  });

  it("renders warning dot class when capacity usage is between 81% and 99%", () => {
    const html = renderToStaticMarkup(
      <SessionCapacityPill totalEnrolled={18} totalCapacity={20} />,
    );
    expect(html).toContain("18/20");
    expect(html).toContain("90%");
    expect(html).toContain("bg-warning");
  });

  it("renders destructive dot class when capacity usage is >= 100%", () => {
    const html = renderToStaticMarkup(
      <SessionCapacityPill totalEnrolled={22} totalCapacity={20} />,
    );
    expect(html).toContain("22/20");
    expect(html).toContain("110%");
    expect(html).toContain("bg-destructive");
  });

  it("renders muted dot class when capacity is 0", () => {
    const html = renderToStaticMarkup(
      <SessionCapacityPill totalEnrolled={5} totalCapacity={0} />,
    );
    expect(html).toContain("5");
    expect(html).toContain("bg-muted-foreground/60");
  });
});
