import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ObligationsWakalaSummarySection,
  type WakalaSummaryEntry,
} from "./ObligationsWakalaSummarySection";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) =>
      params ? `${key} ${Object.values(params).join(" ")}` : key,
  }),
}));

vi.mock("@/hooks/useWorkDirectoryViewMode", () => ({
  useWorkDirectoryViewMode: () => ({
    viewMode: "table" as const,
    setViewMode: vi.fn(),
  }),
}));

const mockEntries: WakalaSummaryEntry[] = [
  {
    key: "wakala-1",
    label: "Sheikh Ahmad",
    repName: "Sheikh Ahmad",
    mujtahidName: "Ayatollah Sistani",
    obligationType: "Khums",
    count: 12,
    total: 2400,
    hasWakala: true,
    distributions: [
      {
        id: "dist-1",
        name: "Sahm-e Imam",
        percentage: 50,
        type: "Liability",
        wakala_type_id: "wt-1",
      },
      {
        id: "dist-2",
        name: "Sahm-e Sadat",
        percentage: 50,
        type: "Income",
        wakala_type_id: "wt-1",
      },
    ],
  },
];

describe("ObligationsWakalaSummarySection", () => {
  it("renders empty state when wakalaSummary is empty", () => {
    const markup = renderToStaticMarkup(
      <ObligationsWakalaSummarySection
        wakalaSummary={[]}
        totalAmount={0}
        activeCurrencyCode="USD"
        formatCurrency={(val) => `$${val}`}
      />,
    );
    expect(markup).toContain("obligations.summary.emptyFiltered");
  });

  it("renders cards layout in cards mode", () => {
    const markup = renderToStaticMarkup(
      <ObligationsWakalaSummarySection
        wakalaSummary={mockEntries}
        totalAmount={2400}
        activeCurrencyCode="USD"
        formatCurrency={(val) => `$${val}`}
        viewMode="cards"
      />,
    );
    expect(markup).toContain("Sheikh Ahmad");
    expect(markup).toContain("Ayatollah Sistani");
    expect(markup).toContain("Khums");
    expect(markup).toContain("$2400");
    expect(markup).toContain("Sahm-e Imam");
    expect(markup).toContain("Sahm-e Sadat");
    expect(markup).not.toContain("<table");
  });

  it("renders Table in table mode", () => {
    const markup = renderToStaticMarkup(
      <ObligationsWakalaSummarySection
        wakalaSummary={mockEntries}
        totalAmount={2400}
        activeCurrencyCode="USD"
        formatCurrency={(val) => `$${val}`}
        viewMode="table"
      />,
    );
    expect(markup).toContain("<table");
    expect(markup).toContain("Sheikh Ahmad");
    expect(markup).toContain("Ayatollah Sistani");
    expect(markup).toContain("Khums");
    expect(markup).toContain("$2400");
  });
});
