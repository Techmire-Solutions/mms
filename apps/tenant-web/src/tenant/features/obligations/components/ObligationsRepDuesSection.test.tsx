import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ObligationsRepDuesSection, type RepSummaryEntry } from "./ObligationsRepDuesSection";

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) =>
      params ? `${key} ${Object.values(params).join(" ")}` : key,
  }),
}));

vi.mock("@mms/fe-core/tenant", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mms/fe-core/tenant")>();
  return {
    ...actual,

    useWorkDirectoryViewMode: () => ({
      viewMode: "table" as const,
      setViewMode: vi.fn(),
    }),
  };
});

const mockEntries: RepSummaryEntry[] = [
  {
    key: "rep-1",
    repName: "Syed Ali",
    mujtahidName: "Ayatollah Sistani",
    count: 8,
    total: 1600,
    due: 160,
    byType: { Khums: 1600 },
  },
];

describe("ObligationsRepDuesSection", () => {
  it("renders empty state when repSummary is empty", () => {
    const markup = renderToStaticMarkup(
      <ObligationsRepDuesSection
        repSummary={[]}
        totalAmount={0}
        activeCurrencyCode="USD"
        formatCurrency={(val) => `$${val}`}
        formatValueOnly={(val) => `${val}`}
      />,
    );
    expect(markup).toContain("obligations.summary.emptyFiltered");
  });

  it("renders cards layout in cards mode", () => {
    const markup = renderToStaticMarkup(
      <ObligationsRepDuesSection
        repSummary={mockEntries}
        totalAmount={1600}
        activeCurrencyCode="USD"
        formatCurrency={(val) => `$${val}`}
        formatValueOnly={(val) => `${val}`}
        viewMode="cards"
      />,
    );
    expect(markup).toContain("Syed Ali");
    expect(markup).toContain("Ayatollah Sistani");
    expect(markup).toContain("$1600");
    expect(markup).toContain("$160");
    expect(markup).not.toContain("<table");
  });

  it("renders Table in table mode", () => {
    const markup = renderToStaticMarkup(
      <ObligationsRepDuesSection
        repSummary={mockEntries}
        totalAmount={1600}
        activeCurrencyCode="USD"
        formatCurrency={(val) => `$${val}`}
        formatValueOnly={(val) => `${val}`}
        viewMode="table"
      />,
    );
    expect(markup).toContain("<table");
    expect(markup).toContain("Syed Ali");
    expect(markup).toContain("Ayatollah Sistani");
    expect(markup).toContain("$1600");
    expect(markup).toContain("$160");
  });
});
