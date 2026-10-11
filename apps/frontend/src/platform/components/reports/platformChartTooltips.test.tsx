import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PlatformCountTooltip, PlatformDistributionTooltip } from "./platformChartTooltips";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("platform chart tooltips", () => {
  it("retains the period and a zero count", () => {
    const html = renderToStaticMarkup(
      <PlatformCountTooltip
        active
        label="2026-09"
        payload={[{ graphicalItemId: "ops", name: "Operations", value: 0 }]}
      />,
    );
    expect(html).toContain("2026-09");
    expect(html).toContain(">0</p>");
  });

  it("uses the category name for a pie slice", () => {
    const html = renderToStaticMarkup(
      <PlatformDistributionTooltip
        active
        payload={[{ graphicalItemId: "inactive", name: "Inactive workspaces", value: 12 }]}
      />,
    );
    expect(html).toContain("Inactive workspaces");
    expect(html).toContain(">12</p>");
  });

  it("does not render inactive or empty tooltips", () => {
    expect(
      renderToStaticMarkup(
        <PlatformCountTooltip active={false} payload={[{ graphicalItemId: "count", value: 12 }]} />,
      ),
    ).toBe("");
    expect(renderToStaticMarkup(<PlatformDistributionTooltip active payload={[]} />)).toBe("");
  });
});
