import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WakalaDistributionList } from "./WakalaDistributionList";
import type { ObligationDistribution } from "@/lib/data/obligationsData";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

const mockDistributions: ObligationDistribution[] = [
  {
    id: "dist-1",
    wakala_type_id: "wt-1",
    name: "General Relief Fund",
    type: "Income",
    percentage: 40,
  },
];

const mockT = ((key: string, opts?: Record<string, unknown>) =>
  opts ? `${key}:${JSON.stringify(opts)}` : key) as unknown as TranslationFunction;

describe("WakalaDistributionList Component", () => {
  it("renders card view with distribution details and touch-friendly buttons", () => {
    const html = renderToStaticMarkup(
      <WakalaDistributionList
        distributions={mockDistributions}
        distributionTypeConfig={{}}
        t={mockT}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        viewMode="cards"
      />,
    );

    expect(html).toContain("General Relief Fund");
    expect(html).toContain("40%");
    expect(html).toContain("min-h-11 min-w-11");
  });

  it("renders table view with distribution details and touch-friendly buttons", () => {
    const html = renderToStaticMarkup(
      <WakalaDistributionList
        distributions={mockDistributions}
        distributionTypeConfig={{}}
        t={mockT}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        viewMode="table"
      />,
    );

    expect(html).toContain("General Relief Fund");
    expect(html).toContain("40%");
    expect(html).toContain("min-h-11 min-w-11");
  });
});
