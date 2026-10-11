import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WakalaTypeCard } from "./WakalaTypeCard";
import type { WakalaType } from "@/lib/data/obligationsData";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

const mockWakalaType: WakalaType = {
  id: "wt-1",
  obligation_type_id: "ot-1",
  mujtahid_representative_id: "mr-1",
};

const mockT = ((key: string, opts?: Record<string, unknown>) =>
  opts ? `${key}:${JSON.stringify(opts)}` : key) as unknown as TranslationFunction;

describe("WakalaTypeCard Component", () => {
  it("renders type name, representative, and mujtahid name", () => {
    const html = renderToStaticMarkup(
      <WakalaTypeCard
        wakalaType={mockWakalaType}
        typeName="Khums Sehm-e-Imam"
        repName="Agha Ali"
        mujtahidName="Ayatollah Sistani"
        wakalaDistributions={[]}
        total={50}
        isComplete={false}
        distributionTypeConfig={{}}
        t={mockT}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onEditDistribution={vi.fn()}
        onDeleteDistribution={vi.fn()}
        onAddDistribution={vi.fn()}
      />,
    );

    expect(html).toContain("Khums Sehm-e-Imam");
    expect(html).toContain("Agha Ali");
    expect(html).toContain("Ayatollah Sistani");
  });
});
